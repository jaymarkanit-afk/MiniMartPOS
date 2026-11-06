"use strict";
// USB card reader. Real hardware is not available, so a reader is simulated with real
// key events at exact speeds. This suite runs alone, because its timing matters.
const { BLOCKED_HOSTS } = require("../lib/chrome");
const { sleep } = require("../lib/cdp");

const expect = (actual, expected, label) => {
  const [a, b] = [JSON.stringify(actual), JSON.stringify(expected)];
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`.slice(0, 500));
};
const tests = [];

// The Settings test panel reports every burst, so it shows what the module saw.
const openPanel = async (page) => {
  await page.seed();
  await page.goto("settings.html");
  await page.eval("document.getElementById('usbReaderTest').click()");
};
const lastTap = (page) => page.eval(() => {
  const row = document.querySelector("#usbReaderTaps li");
  return row ? { text: row.querySelector("code").textContent, lines: [...row.querySelectorAll("p")].map((line) => line.textContent) } : null;
});
const worksAsCard = (tap) => tap.lines.at(-1) === "Works as a card: yes";

for (const gap of [5, 20, 35]) {
  for (const length of [4, 8, 10, 13]) {
    tests.push({
      name: `a ${length}-character burst at ${gap} ms is recognized`,
      run: async ({ page }) => {
        await openPanel(page);
        const code = "1234567890123".slice(0, length);
        // A stall in this computer can look like a slow reader, so that try is repeated.
        let tap = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          await page.typeBurst(code, { gap });
          tap = await lastTap(page);
          const slowest = Math.max(...tap.lines[3].match(/[\d.]+/g).map(Number));
          if (worksAsCard(tap) || slowest <= gap + 100) break;
        }
        expect(tap.text, code, "text");
        expect(worksAsCard(tap), true, `recognized: ${tap.lines.join(" | ")}`);
      },
    });
  }
}

for (const gap of [80, 150, 300]) {
  tests.push({
    name: `typing at ${gap} ms is never recognized, even with Enter at the end`,
    run: async ({ page }) => {
      await openPanel(page);
      await page.typeBurst("1234567890", { gap });
      const tap = await lastTap(page);
      expect(tap.lines.at(-1), "Works as a card: no. It was too slow to be a reader.", "verdict");
    },
  });
}

tests.push({
  name: "leading zeros are kept",
  run: async ({ page }) => {
    await openPanel(page);
    await page.typeBurst("0004521977", { gap: 10 });
    expect((await lastTap(page)).text, "0004521977", "text");
  },
});

tests.push({
  name: "a Tab can end a burst",
  run: async ({ page }) => {
    await openPanel(page);
    await page.typeBurst("0004521977", { gap: 10, terminator: "Tab" });
    const tap = await lastTap(page);
    expect(tap.lines[4], "Ended with: Tab", "terminator");
    expect(worksAsCard(tap), true, "recognized");
  },
});

tests.push({
  name: "lowercase hex is shown exactly as it was sent",
  run: async ({ page }) => {
    await openPanel(page);
    await page.typeBurst("04a1b2c3d4", { gap: 10 });
    const tap = await lastTap(page);
    expect(tap.text, "04a1b2c3d4", "text");
    expect(tap.lines[1], "All digits: no", "digits");
    expect(worksAsCard(tap), true, "recognized");
  },
});

tests.push({
  name: "too short and too long are not cards",
  run: async ({ page }) => {
    await openPanel(page);
    await page.typeBurst("123", { gap: 5 });
    expect((await lastTap(page)).lines.at(-1), "Works as a card: no. It must be 4 to 32 characters.", "short");
    await page.typeBurst("1".repeat(33), { gap: 5 });
    expect((await lastTap(page)).lines.at(-1), "Works as a card: no. It must be 4 to 32 characters.", "long");
  },
});

tests.push({
  name: "characters a card cannot contain are rejected but still shown",
  run: async ({ page }) => {
    await openPanel(page);
    await page.typeBurst(";1234=56?", { gap: 5 });
    const tap = await lastTap(page);
    expect(tap.text, ";1234=56?", "text");
    expect(tap.lines.at(-1), "Works as a card: no. It has characters a card code cannot contain.", "verdict");
  },
});

tests.push({
  name: "the test panel shows length, digits, timing and terminator",
  run: async ({ page }) => {
    await openPanel(page);
    await page.typeBurst("00123456", { gap: 20 });
    const tap = await lastTap(page);
    expect(tap.text, "00123456", "text");
    expect(tap.lines.slice(0, 2), ["Length: 8", "All digits: yes"], "details");
    if (!/^Average gap: \d+\.\d ms$/.test(tap.lines[2])) throw new Error(tap.lines[2]);
    expect(tap.lines[3].split(",").length, 8, "gaps listed");
    expect(tap.lines[4], "Ended with: Enter", "terminator");
  },
});

tests.push({
  name: "the test panel keeps the last 5 taps, newest first",
  run: async ({ page }) => {
    await openPanel(page);
    for (let tap = 1; tap <= 7; tap += 1) {
      await page.typeBurst(`000${tap}`, { gap: 5 });
    }
    expect(await page.eval("[...document.querySelectorAll('#usbReaderTaps code')].map(c=>c.textContent)"),
      ["0007", "0006", "0005", "0004", "0003"], "taps");
  },
});

tests.push({
  name: "the test panel shows a reader that sends no terminator",
  run: async ({ page }) => {
    await openPanel(page);
    await page.eval("window.__sentinel=true");
    for (const character of "12345678") {
      await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: character, text: character });
    }
    await sleep(500);
    const tap = await lastTap(page);
    expect(tap.text, "12345678", "text");
    expect(tap.lines[4], "Ended with: none", "terminator");
    expect(tap.lines.at(-1), "Works as a card: no. It did not end with Enter or Tab.", "verdict");
  },
});

tests.push({
  name: "the test panel text can be selected and stops when asked",
  run: async ({ page }) => {
    await openPanel(page);
    await page.typeBurst("12345678", { gap: 5 });
    expect(await page.eval("getComputedStyle(document.querySelector('#usbReaderTaps code')).userSelect"), "all", "selectable");
    await page.eval("document.getElementById('usbReaderTest').click()");
    await page.typeBurst("87654321", { gap: 5 });
    expect((await lastTap(page)).text, "12345678", "no tap after stopping");
  },
});

tests.push({
  name: "the module stores and sends nothing, and reads only the sanitized code",
  run: async ({ server }) => {
    const code = server.source("js/usb-reader.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const banned = ["localStorage", "sessionStorage", "indexedDB", "document.cookie", "fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "safeWrite", "console.", "innerHTML", "navigator.serial", "navigator.hid", "clipboard"];
    expect(banned.filter((word) => code.includes(word)), [], "forbidden calls");
    expect(/findByCardCode\?\.\(code\)/.test(code), true, "lookup uses the sanitized code");
    expect(/finishCapture\(code\)/.test(code) && /onCard\?\.\(code, suki\)/.test(code), true, "pages get the sanitized code");
    expect(/normalizeCardCode\(text\)/.test(code), true, "code is sanitized");
  },
});

tests.push({
  name: "the sanitizer keeps the exact text, uppercased, and rejects anything else",
  run: async ({ page }) => {
    await page.seed();
    await page.goto("settings.html");
    const results = await page.eval(() => ["0004521977", " 04a1b2 ", "04:A1-B2", "abc", "<img src=x>", "12;34", "1".repeat(33), null].map((value) => window.normalizeCardCode(value)));
    expect(results, ["0004521977", "04A1B2", "04:A1-B2", "", "", "", "", ""], "codes");
  },
});

tests.push({
  name: "Settings has no console errors after a test tap",
  run: async ({ page }) => {
    await openPanel(page);
    await page.typeBurst("12345678", { gap: 5 });
    const problems = page.problems.filter((problem) => !BLOCKED_HOSTS.some((host) => `${problem.text} ${problem.url || ""}`.includes(host)));
    expect(problems, [], "problems");
  },
});

const PLAIN = '[{"id":"a1","name":"Ana","phone":"","joined":"2026-01-02","nfcId":"AA:BB","stamps":12,"active":true,"history":[]}]';
const openStore = async (page, customers) => {
  await page.seed({ miniMartSukis: customers });
  await page.goto("suki-reward.html");
};
const stored = (page) => page.eval("JSON.parse(localStorage.getItem('miniMartSukis'))");
const customer = (id, name, extra = {}) => ({ id, name, phone: "", joined: "2026-01-02", nfcId: "", stamps: 0, active: true, history: [], ...extra });

tests.push({
  name: "a customer with no card stays byte-identical after load and after a save",
  run: async ({ page }) => {
    await openStore(page, PLAIN);
    expect(await page.eval("localStorage.getItem('miniMartSukis')"), PLAIN, "after load");
    await page.eval("(()=>{const s=sukiStore;s.save(s.read())})()");
    expect(await page.eval("localStorage.getItem('miniMartSukis')"), PLAIN, "after a save");
  },
});

tests.push({
  name: "a card code is saved on the right customer, next to the phone card",
  run: async ({ page }) => {
    await openStore(page, [customer("a", "Ana", { nfcId: "AA:BB" }), customer("b", "Ben")]);
    expect(await page.eval("sukiStore.setCardCode('b','0004521977').ok"), true, "saved");
    const [ana, ben] = await stored(page);
    expect("cardCode" in ana, false, "other customer");
    expect(ben.cardCode, "0004521977", "card code");
    expect(await page.eval("sukiStore.findByCardCode('0004521977')?.name"), "Ben", "lookup");
    expect(await page.eval("sukiStore.findByCardCode('4521977')"), null, "no partial match");
  },
});

tests.push({
  name: "a customer can have both a phone card and a USB card",
  run: async ({ page }) => {
    await openStore(page, [customer("a", "Ana", { nfcId: "AA:BB" })]);
    await page.eval("sukiStore.setCardCode('a','0004521977')");
    const [ana] = await stored(page);
    expect([ana.nfcId, ana.cardCode], ["AA:BB", "0004521977"], "both");
  },
});

tests.push({
  name: "a second customer cannot take the same card",
  run: async ({ page }) => {
    await openStore(page, [customer("a", "Ana", { cardCode: "0004521977" }), customer("b", "Ben")]);
    const result = await page.eval("(()=>{const r=sukiStore.setCardCode('b','0004521977');return {ok:r.ok,message:r.error?.message}})()");
    expect(result, { ok: false, message: "This card is already registered to Ana." }, "result");
    expect("cardCode" in (await stored(page))[1], false, "second customer");
  },
});

tests.push({
  name: "a save cannot give two customers the same card",
  run: async ({ page }) => {
    await openStore(page, [customer("a", "Ana", { cardCode: "0004521977" }), customer("b", "Ben")]);
    const result = await page.eval("(()=>{const l=sukiStore.read();l[1].cardCode='0004521977';const r=sukiStore.save(l);return {ok:r.ok,message:r.error?.message}})()");
    expect(result, { ok: false, message: "This card is already registered to Ana." }, "result");
  },
});

tests.push({
  name: "a card code that is not valid is refused",
  run: async ({ page }) => {
    await openStore(page, [customer("a", "Ana")]);
    expect(await page.eval("sukiStore.setCardCode('a','<b>').ok"), false, "saved");
    expect("cardCode" in (await stored(page))[0], false, "stored");
  },
});

tests.push({
  name: "a points change keeps the card code",
  run: async ({ page }) => {
    await openStore(page, [customer("a", "Ana", { cardCode: "0004521977" })]);
    await page.eval("sukiStore.applyPointsChange('a',{kind:'earn',points:2})");
    const [ana] = await stored(page);
    expect([ana.cardCode, ana.stamps], ["0004521977", 2], "customer");
  },
});

tests.push({
  name: "backup and restore keep the card code, and an older backup still restores",
  run: async ({ page }) => {
    await page.seed({ miniMartSukis: [customer("a", "Ana", { cardCode: "0004521977" })] });
    await page.goto("settings.html");
    const data = await page.eval("readBackupData()");
    expect(data.customers[0].cardCode, "0004521977", "in the backup");
    await page.eval((backup) => { restoreBackupData(backup); }, data);
    await page.goto("suki-reward.html");
    expect((await stored(page))[0].cardCode, "0004521977", "after restore");
    await page.goto("settings.html");
    await page.eval((backup) => { restoreBackupData(backup); }, { ...data, customers: JSON.parse(PLAIN) });
    await page.goto("suki-reward.html");
    expect(await page.eval("localStorage.getItem('miniMartSukis')"), PLAIN, "older backup");
  },
});

const CARD = "0004521977";
const SEEDS = ["Sprite 1.5L", "Nature's Spring 500ml", "Nestea Lemon 1L", "Lucky Me Pancit Canton", "Lucky Me Chicken Noodles", "Payless Xtra Big", "Nissin Cup Noodles", "Piattos 40g", "Chippy Barbecue 110g", "Choc Nut 24g", "Nova Country 78g", "Bear Brand 33g", "Alaska Fortified Milk 1L", "Selecta Ice Cream Cup", "Yakult 5-Pack", "Skyflakes Crackers"];
const product = (id, name, barcode) => ({ id, name, category: "Snacks", price: 10, costPrice: 5, stock: 9, unit: "piece", icon: "x", accent: "var(--gold)", barcode });
const shop = {
  miniMartSukis: [customer("a", "Ana", { cardCode: CARD, stamps: 12 }), customer("b", "Ben")],
  miniMartProducts: [product("p1", "Rice", "4800016644801"), product("p2", "Soap", "ABC-123")],
  miniMartDeletedProducts: [...SEEDS, "Coke 1.5L"],
};
const openCheckout = async (page) => {
  await page.seed(shop);
  await page.goto("index.html");
};
const cartLines = (page) => page.eval("[...cart.values()].map(i=>[i.name,i.quantity])");
const selected = (page) => page.eval("selectedSukiId");
const value = (page, id) => page.eval((target) => document.getElementById(target).value, id);
const addToCart = (page) => page.eval("addProductToCart(window.miniMartDB.products()[0])");

tests.push({
  name: "a card tapped with nothing focused selects the customer and leaves the cart alone",
  run: async ({ page }) => {
    await openCheckout(page);
    await addToCart(page);
    await page.eval("document.activeElement.blur()");
    await page.typeBurst(CARD, { gap: 10 });
    expect(await selected(page), "a", "customer");
    expect(await cartLines(page), [["Rice", 1]], "cart");
    expect(await page.eval("document.getElementById('checkoutSukiScanStatus').textContent"), "Ana selected.", "status");
  },
});

tests.push({
  name: "a card tapped in the Checkout search box leaves the box as it was",
  run: async ({ page }) => {
    await openCheckout(page);
    await addToCart(page);
    await page.click("#search");
    await page.eval("search.value='ri';search.dispatchEvent(new Event('input',{bubbles:true}));search.setSelectionRange(1,1)");
    await page.typeBurst(CARD, { gap: 10 });
    expect(await selected(page), "a", "customer");
    expect(await page.eval("[search.value,search.selectionStart]"), ["ri", 1], "search box and cursor");
    expect(await cartLines(page), [["Rice", 1]], "cart");
    expect(await page.eval("document.getElementById('barcodeStatus').classList.contains('is-error')"), false, "barcode error");
  },
});

tests.push({
  name: "a card tapped in the amount box leaves it as it was",
  run: async ({ page }) => {
    await openCheckout(page);
    await addToCart(page);
    await page.eval("amountGiven.value='20';updatePayment();amountGiven.focus()");
    await page.typeBurst(CARD, { gap: 10 });
    expect(await page.eval("amountGiven.value"), "20", "amount box");
    expect(await selected(page), "a", "customer");
  },
});

tests.push({
  name: "typing a customer's card number by hand is not a card",
  run: async ({ page }) => {
    await openCheckout(page);
    await page.click("#search");
    await page.typeBurst(CARD, { gap: 80 });
    expect(await selected(page), "", "customer");
    expect(await value(page, "search"), CARD, "search box");
  },
});

for (const [kind, barcode] of [["all-digit", "4800016644801"], ["letters", "ABC-123"]]) {
  tests.push({
    name: `an ${kind === "letters" ? "" : ""}${kind} barcode no customer owns still adds the product`.replace("an letters", "a letters"),
    run: async ({ page }) => {
      await openCheckout(page);
      await page.click("#search");
      await page.typeBurst(barcode, { gap: 10 });
      expect(await cartLines(page), [[kind === "letters" ? "Soap" : "Rice", 1]], "cart");
      expect(await selected(page), "", "customer");
      expect(await page.eval("document.getElementById('barcodeStatus').textContent").then((text) => text.startsWith("Added")), true, "barcode status");
    },
  });
}

tests.push({
  name: "an unknown code at Checkout gets the normal barcode message",
  run: async ({ page }) => {
    await openCheckout(page);
    await page.click("#search");
    await page.typeBurst("9999999999", { gap: 10 });
    expect(await page.eval("document.getElementById('barcodeStatus').textContent"), "This barcode is not registered. Add it to a product in Inventory.", "status");
  },
});

const HONEST_HELP = "Tap a card on the USB reader. The page cannot see the reader until a card is tapped.";
const FORBIDDEN = /\b(ready|detected|connected|available|not supported)\b/i;
const statusText = (page, ids) => page.eval((list) => list.map((id) => document.getElementById(id)?.textContent ?? "").join(" | "), ids);
const expectHonest = (shown, label) => {
  const match = shown.match(FORBIDDEN);
  if (match) throw new Error(`${label} says "${match[0]}": ${shown}`.slice(0, 300));
  if (!shown.includes("Waiting for a card")) throw new Error(`${label} does not say Waiting for a card: ${shown}`.slice(0, 300));
};
const openSuki = async (page, storage = shop) => {
  await page.seed(storage);
  await page.goto("suki-reward.html");
};
const text = (page, id) => page.eval((target) => document.getElementById(target).textContent.trim(), id);

tests.push({
  name: "the Scan tab says waiting for a card, and never the red message",
  run: async ({ page }) => {
    await openSuki(page);
    expect(await page.eval("document.getElementById('usbReaderState').hidden"), false, "state hidden");
    expect(await text(page, "usbReaderStateTitle"), "Waiting for a card", "state");
    expect(await text(page, "usbReaderStateHelp"), HONEST_HELP, "help");
    expect(await page.eval("document.body.textContent.includes('NFC scanning is unavailable')"), false, "red message");
  },
});

tests.push({
  name: "a registered card shows the customer, the same as a phone tap",
  run: async ({ page }) => {
    await openSuki(page);
    await page.typeBurst(CARD, { gap: 10 });
    expect(await text(page, "scanTitle"), "Ana", "title");
    expect(await text(page, "scanStatus"), "12/40 points • ₱12.00 reward", "status");
    expect(await page.eval("document.getElementById('sukiDetailModal')?.hidden ?? detailModal.hidden"), false, "detail hidden");
  },
});

tests.push({
  name: "a registered card works in the search box on the All Sukis tab",
  run: async ({ page }) => {
    await openSuki(page);
    await page.eval("document.getElementById('allSukisTab').click()");
    const box = await page.eval("(()=>{const box=document.querySelector('#allSukisView input[type=search], #allSukisView input');box.id=box.id||'sukiListSearch';box.focus();return box.id})()");
    await page.typeBurst(CARD, { gap: 10 });
    expect(await value(page, box), "", "search box");
    expect(await text(page, "scanTitle"), "Ana", "title");
  },
});

tests.push({
  name: "an unknown card shows the message, and attaching saves it on the right customer",
  run: async ({ page }) => {
    await openSuki(page);
    await page.typeBurst("A1B2C3D4", { gap: 10 });
    expect(await page.eval("document.getElementById('usbCardUnknown').hidden"), false, "unknown hidden");
    expect(await text(page, "scanTitle"), "Card not registered", "title");
    expect(await text(page, "usbUnknownCode"), "Card A1B2C3D4", "code");
    expect(await page.eval("[...document.getElementById('usbAttachCustomer').options].map(o=>o.textContent)"), ["Ben"], "customers offered");
    await page.click("#usbAttachCard");
    await sleep(60);
    const [ana, ben] = await stored(page);
    expect([ana.cardCode, ben.cardCode], [CARD, "A1B2C3D4"], "card codes");
    expect(await text(page, "scanTitle"), "Ben", "title");
  },
});

tests.push({
  name: "on the All Sukis tab an unknown code is left alone",
  run: async ({ page }) => {
    await openSuki(page);
    await page.eval("document.getElementById('allSukisTab').click()");
    await page.typeBurst("A1B2C3D4", { gap: 10 });
    expect(await page.eval("document.getElementById('usbCardUnknown').hidden"), true, "unknown hidden");
  },
});

const openAddForm = async (page) => {
  await openSuki(page);
  await page.eval("openAddSukiForm()");
  await page.click("#addUsbCardScan");
};
const saveNewCustomer = async (page) => {
  await page.eval(() => {
    const name = document.getElementById("sukiName");
    name.value = "New Person";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("addSukiForm").requestSubmit();
  });
  await sleep(80);
};

tests.push({
  name: "Add Suki: the button captures a card and it is saved with the customer",
  run: async ({ page }) => {
    await openAddForm(page);
    expect(await text(page, "addUsbCardStatus"), "Tap the card on the reader now.", "prompt");
    await page.typeBurst("A1B2C3D4", { gap: 10 });
    expect(await text(page, "addUsbCardStatus"), "Card A1B2C3D4 will be saved with this customer.", "status");
    await saveNewCustomer(page);
    expect((await stored(page)).at(-1).cardCode, "A1B2C3D4", "card code");
  },
});

tests.push({
  name: "Add Suki: a card scanned in the name box leaves it as it was and does not submit",
  run: async ({ page }) => {
    await openAddForm(page);
    await page.eval("(()=>{const n=document.getElementById('sukiName');n.value='Jo';n.focus()})()");
    await page.typeBurst("A1B2C3D4", { gap: 10 });
    expect(await value(page, "sukiName"), "Jo", "name box");
    expect((await stored(page)).length, 2, "customers");
    expect(await page.eval("document.getElementById('addSukiModal')?.hidden ?? addSukiModal.hidden"), false, "form closed");
  },
});

tests.push({
  name: "a card tapped in a customer name box leaves it as it was",
  run: async ({ page }) => {
    await openSuki(page);
    await page.eval("openAddSukiForm()");
    await page.eval("(()=>{const n=document.getElementById('sukiName');n.value='Jo';n.focus()})()");
    await page.typeBurst(CARD, { gap: 10 });
    expect(await value(page, "sukiName"), "Jo", "name box");
    expect((await stored(page)).length, 2, "customers");
  },
});

tests.push({
  name: "Add Suki: a card someone else owns is reported and not kept",
  run: async ({ page }) => {
    await openAddForm(page);
    await page.typeBurst(CARD, { gap: 10 });
    expect(await text(page, "addUsbCardStatus"), "This card is already registered to Ana.", "status");
    await saveNewCustomer(page);
    expect("cardCode" in (await stored(page)).at(-1), false, "card code");
  },
});

tests.push({
  name: "Add Suki: Cancel stops the capture cleanly",
  run: async ({ page }) => {
    await openAddForm(page);
    await page.click("#addUsbCardCancel");
    await sleep(60);
    expect(await text(page, "addUsbCardStatus"), "Cancelled.", "status");
    expect(await page.eval("[addUsbCardScan.disabled,addUsbCardCancel.hidden]"), [false, true], "buttons");
    await page.click("#addUsbCardScan");
    await page.typeBurst("A1B2C3D4", { gap: 10 });
    expect(await text(page, "addUsbCardStatus"), "Card A1B2C3D4 will be saved with this customer.", "a new capture works");
  },
});

tests.push({
  name: "Add Suki: the capture times out after 15 seconds",
  run: async ({ page }) => {
    await page.useFakeLongTimers();
    await openAddForm(page);
    expect(await page.eval("window.__longTimers().filter(ms=>ms===15000).length"), 2, "the time limit, beside the page's own loading limit");
    expect(await text(page, "addUsbCardStatus"), "Tap the card on the reader now.", "still waiting");
    await page.eval("window.__fireLongTimers(15000)");
    await sleep(30);
    expect(await text(page, "addUsbCardStatus"), "No card was read. Try again.", "after 15 seconds");
    expect(await page.eval("[addUsbCardScan.disabled,addUsbCardCancel.hidden]"), [false, true], "buttons");
  },
});

tests.push({
  name: "closing Add Suki stops a capture",
  run: async ({ page }) => {
    await openAddForm(page);
    await page.eval("closeAddSukiForm()");
    await page.typeBurst("A1B2C3D4", { gap: 10 });
    expect(await page.eval("document.getElementById('usbCardUnknown').hidden"), false, "the tap is an ordinary scan again");
  },
});

tests.push({
  name: "edit customer: the button attaches a card, and reports a duplicate",
  run: async ({ page }) => {
    await openSuki(page);
    await page.eval("showSukiDetails('b')");
    await page.eval("[...document.querySelectorAll('[data-usb-card-box] button')].find(b=>b.textContent.startsWith('Scan')).click()");
    await page.typeBurst(CARD, { gap: 10 });
    expect(await page.eval("document.querySelector('[data-usb-card-box] p').textContent"), "This card is already registered to Ana.", "duplicate");
    await page.eval("[...document.querySelectorAll('[data-usb-card-box] button')].find(b=>b.textContent.startsWith('Scan')).click()");
    await page.typeBurst("A1B2C3D4", { gap: 10 });
    expect((await stored(page))[1].cardCode, "A1B2C3D4", "card code");
    expect(await page.eval("document.querySelector('[data-usb-card-box] strong').textContent"), "A1B2C3D4", "shown");
  },
});

tests.push({
  name: "the phone NFC path still works, and shows no USB controls",
  run: async ({ page }) => {
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: "window.NDEFReader=class{async scan(){setTimeout(()=>this.onreading({serialNumber:'aa-bb'}),10)}};",
    });
    await page.seed({ miniMartSukis: [customer("a", "Ana", { nfcId: "AA:BB", stamps: 12 })] });
    await page.goto("suki-reward.html");
    expect(await page.eval("[document.getElementById('usbReaderState').hidden,document.getElementById('addUsbCardBox').hidden]"), [true, true], "USB controls hidden");
    await page.eval("scanExistingSuki()");
    await sleep(100);
    expect(await text(page, "scanTitle"), "Ana", "title");
    expect(await text(page, "scanStatus"), "12/40 points • ₱12.00 reward", "status");
    await page.goto("index.html");
    await page.eval("scanSukiCard()");
    await sleep(100);
    expect(await selected(page), "a", "Checkout customer");
  },
});

tests.push({
  name: "a fresh Suki Rewards page claims nothing about the reader",
  run: async ({ page }) => {
    await openSuki(page);
    expectHonest(await statusText(page, ["scanTitle", "scanStatus", "usbReaderStateTitle", "usbReaderStateHelp"]), "Suki Rewards");
  },
});

tests.push({
  name: "a fresh Checkout page claims nothing about the reader",
  run: async ({ page }) => {
    await openCheckout(page);
    await addToCart(page);
    expectHonest(await statusText(page, ["checkoutSukiScanStatus"]), "Checkout");
  },
});

tests.push({
  name: "a fresh Settings page claims nothing about the reader",
  run: async ({ page }) => {
    await page.seed();
    await page.goto("settings.html");
    expectHonest(await statusText(page, ["usbReaderStateTitle", "usbReaderStateHelp", "nfcStatusText", "nfcStatusExplanation"]), "Settings");
  },
});

tests.push({
  name: "a good read says Reader working with the time, on every page",
  run: async ({ page }) => {
    await openSuki(page);
    await page.typeBurst(CARD, { gap: 10 });
    expect(await text(page, "usbReaderStateTitle"), "Reader working", "Suki Rewards");
    if (!/^Last read at .*\d/.test(await text(page, "usbReaderStateHelp"))) throw new Error("No time shown");
    await page.seed();
    await page.goto("settings.html");
    expect(await text(page, "usbReaderStateTitle"), "Waiting for a card", "a new page starts again");
    await page.eval("document.getElementById('usbReaderTest').click()");
    await page.typeBurst(CARD, { gap: 10 });
    expect(await text(page, "usbReaderStateTitle"), "Reader working", "Settings");
  },
});

tests.push({
  name: "an unknown card also counts as a read",
  run: async ({ page }) => {
    await openSuki(page);
    await page.typeBurst("A1B2C3D4", { gap: 10 });
    expect(await text(page, "usbReaderStateTitle"), "Reader working", "state");
  },
});

tests.push({
  name: "a duplicate card also counts as a read",
  run: async ({ page }) => {
    await openAddForm(page);
    await page.typeBurst(CARD, { gap: 10 });
    expect(await text(page, "usbReaderStateTitle"), "Reader working", "state");
  },
});

tests.push({
  name: "human typing never counts as a read",
  run: async ({ page }) => {
    await openSuki(page);
    await page.eval("document.getElementById('allSukisTab').click();document.querySelector('#allSukisView input').focus()");
    await page.typeBurst(CARD, { gap: 80 });
    expect(await text(page, "usbReaderStateTitle"), "Waiting for a card", "state");
  },
});

tests.push({
  name: "a barcode no customer owns never counts as a read",
  run: async ({ page }) => {
    await page.seed(shop);
    await page.goto("index.html");
    await page.click("#search");
    await page.eval("window.__reads=0;window.miniMartCardReader.onStatus(()=>{window.__reads+=1})");
    await page.typeBurst("4800016644801", { gap: 10 });
    expect(await page.eval("window.__reads"), 1, "only the first call, when the listener was added");
  },
});

tests.push({
  name: "silence changes nothing, after a read or before one",
  run: async ({ page }) => {
    await page.useFakeLongTimers();
    await openSuki(page);
    const later = "Date.now=(n=>()=>n()+60000)(Date.now)";
    await page.eval(`${later};window.__fireLongTimers()`);
    expect(await text(page, "usbReaderStateTitle"), "Waiting for a card", "before a read");
    await page.typeBurst(CARD, { gap: 10 });
    const shown = await text(page, "usbReaderStateHelp");
    await page.eval(`${later};window.__fireLongTimers()`);
    expect([await text(page, "usbReaderStateTitle"), await text(page, "usbReaderStateHelp")], ["Reader working", shown], "after a read");
  },
});

const armCheckout = async (page) => {
  await page.useFakeLongTimers();
  await openCheckout(page);
  await addToCart(page);
  await page.click("#checkoutSukiScanButton");
};
const noUnsupported = async (page) => {
  const shown = await page.eval("document.body.textContent");
  if (/not supported|unsupported/i.test(shown)) throw new Error("The page says NFC is unsupported");
};

tests.push({
  name: "Checkout: Tap Suki's Card arms card mode for 30 seconds, with no NFC error",
  run: async ({ page }) => {
    await armCheckout(page);
    expect(await text(page, "checkoutSukiScanStatus"), "Waiting for a card. Tap it on the reader now.", "status");
    expect(await page.eval("window.__longTimers().includes(30000)"), true, "time limit");
    expect(await page.eval("[document.getElementById('checkoutUsbCancel').hidden,document.getElementById('checkoutSukiScanStatus').classList.contains('is-error')]"), [false, false], "cancel and red");
    await noUnsupported(page);
    await page.eval("window.__fireLongTimers(30000)");
    await sleep(30);
    expect(await text(page, "checkoutSukiScanStatus"), "No card was read. Press the button to try again.", "after 30 seconds");
    expect(await page.eval("[document.getElementById('checkoutUsbCancel').hidden,document.getElementById('checkoutSukiScanButton').disabled]"), [true, false], "buttons");
  },
});

tests.push({
  name: "Checkout: Cancel ends card mode",
  run: async ({ page }) => {
    await armCheckout(page);
    await page.click("#checkoutUsbCancel");
    await sleep(40);
    expect(await text(page, "checkoutSukiScanStatus"), "Cancelled.", "status");
    await page.click("#search");
    await page.typeBurst("9999999999", { gap: 10 });
    expect(await text(page, "barcodeStatus"), "This barcode is not registered. Add it to a product in Inventory.", "a code is a barcode again");
  },
});

tests.push({
  name: "Checkout: a registered card in card mode selects the customer",
  run: async ({ page }) => {
    await armCheckout(page);
    await page.typeBurst(CARD, { gap: 10 });
    expect(await selected(page), "a", "customer");
    expect(await text(page, "checkoutSukiScanStatus"), "Ana selected.", "status");
  },
});

tests.push({
  name: "Checkout: an unknown card in card mode can be attached, and never says barcode",
  run: async ({ page }) => {
    await armCheckout(page);
    await page.typeBurst("A1B2C3D4", { gap: 10 });
    expect(await page.eval("document.getElementById('checkoutUsbUnknown').hidden"), false, "unknown hidden");
    expect((await text(page, "checkoutUsbUnknown")).startsWith("Card not registered"), true, "message");
    expect(await page.eval("document.getElementById('barcodeStatus').textContent.includes('barcode is not registered')"), false, "barcode message");
    expect(await page.eval("[...document.getElementById('checkoutUsbCustomer').options].map(o=>o.textContent)"), ["Ben"], "customers");
    await page.click("#checkoutUsbAttach");
    await sleep(60);
    const [ana, ben] = await stored(page);
    expect([ana.cardCode, ben.cardCode], [CARD, "A1B2C3D4"], "card codes");
    expect(await selected(page), "b", "customer selected");
  },
});

tests.push({
  name: "Scan tab: the NFC icon arms card mode for 30 seconds, with no NFC error",
  run: async ({ page }) => {
    await page.useFakeLongTimers();
    await openSuki(page);
    await page.click("#scanButton");
    expect(await text(page, "scanTitle"), "Waiting for a card. Tap it on the reader now.", "title");
    expect(await page.eval("window.__longTimers().includes(30000)"), true, "time limit");
    await noUnsupported(page);
    await page.eval("window.__fireLongTimers(30000)");
    await sleep(30);
    expect([await text(page, "scanTitle"), await text(page, "scanStatus")], ["Waiting for a card", "No card was read. Press the icon to try again."], "after 30 seconds");
    await page.click("#scanButton");
    await page.click("#usbScanCancel");
    await sleep(40);
    expect(await text(page, "scanStatus"), "Cancelled.", "cancelled");
    await page.click("#scanButton");
    await page.typeBurst("A1B2C3D4", { gap: 10 });
    expect(await text(page, "scanTitle"), "Card not registered", "unknown card");
  },
});

tests.push({
  name: "Add Suki: the NFC icon starts the USB capture, with no NFC error",
  run: async ({ page }) => {
    await openSuki(page);
    await page.eval("openAddSukiForm()");
    await page.click("#linkNfcButton");
    expect(await text(page, "addUsbCardStatus"), "Tap the card on the reader now.", "status");
    await noUnsupported(page);
  },
});

tests.push({
  name: "the customer panel offers no NFC link on a laptop",
  run: async ({ page }) => {
    await openSuki(page);
    await page.eval("showSukiDetails('b')");
    expect(await page.eval("[Boolean(document.getElementById('linkNfcDetailButton')),document.getElementById('detailContent').textContent.includes('Ready to link')]"), [false, false], "NFC link");
  },
});

const STAND_IN = "window.NDEFReader=class{async scan(){window.__scanned=true}};";
tests.push({
  name: "with Web NFC the Android wording and behaviour are unchanged",
  run: async ({ page }) => {
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: STAND_IN });
    await page.seed(shop);
    await page.goto("suki-reward.html");
    expect(await text(page, "scanTitle"), "Ready for NFC card", "Scan tab");
    expect(await page.eval("document.getElementById('usbReaderState').hidden"), true, "USB state hidden");
    await page.click("#scanButton");
    await sleep(40);
    expect([await text(page, "scanTitle"), await text(page, "scanStatus"), await page.eval("window.__scanned")], ["Waiting for Card...", "Hold the Suki card near the back of your phone.", true], "NFC scan");
    await page.goto("index.html");
    expect(await text(page, "checkoutSukiScanStatus"), "Tap the customer's NFC card to apply rewards.", "Checkout");
    await addToCart(page);
    await page.click("#checkoutSukiScanButton");
    await sleep(40);
    expect(await text(page, "checkoutSukiScanStatus"), "Hold the Suki card near the back of your phone.", "Checkout scan");
    await page.goto("settings.html");
    await sleep(100);
    expect(await text(page, "nfcStatusText") === "Phone only", false, "Settings");
  },
});

for (const [name, file] of [["Checkout", "index"], ["Suki Rewards", "suki-reward"]]) {
  tests.push({
    name: `${name} has no console errors or failed requests after a tap`,
    run: async ({ page, server }) => {
      await page.seed(shop);
      await page.goto(`${file}.html`);
      await page.typeBurst(CARD, { gap: 10 });
      const problems = page.problems.filter((problem) => !BLOCKED_HOSTS.some((host) => `${problem.text} ${problem.url || ""}`.includes(host)));
      expect(problems, [], "problems");
      expect(server.requests.filter(({ status }) => status >= 400), [], "failed requests");
    },
  });
}

module.exports = { tests };
