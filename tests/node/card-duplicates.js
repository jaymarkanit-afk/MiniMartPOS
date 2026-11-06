"use strict";
// Two customers must never share a card. Uses the codes from the real register cards.
const { BLOCKED_HOSTS } = require("../lib/chrome");
const { sleep } = require("../lib/cdp");

const FIRST = "0033194756";
const SECOND = "0016814852";
const BACKUP_PREFIX = "miniMartSukis__cardDuplicates_";
const REFUSED = "This card is already registered to Jaymark Anit.";
const AMBIGUOUS = "This card is registered to two customers. Resolve it on the Suki Rewards page.";
const customer = (id, name, extra = {}) => ({ id, name, phone: "", joined: "2026-01-02", nfcId: "", stamps: 12, active: true, history: [], ...extra });
const jaymark = (extra) => customer("j", "Jaymark Anit", extra);
const kent = (extra) => customer("k", "Kent", extra);
const expect = (actual, expected, label) => {
  const [a, b] = [JSON.stringify(actual), JSON.stringify(expected)];
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`.slice(0, 700));
};
const open = async (page, customers, url = "suki-reward.html", storage = {}) => {
  await page.seed({ miniMartSukis: customers, ...storage });
  await page.goto(url);
};
const stored = (page) => page.eval("JSON.parse(localStorage.getItem('miniMartSukis'))");
const raw = (page) => page.eval("localStorage.getItem('miniMartSukis')");
const codes = async (page) => (await stored(page)).map((suki) => suki.cardCode ?? null);
const backups = (page, prefix = BACKUP_PREFIX) => page.eval((start) => Object.keys(localStorage).filter((key) => key.startsWith(start)), prefix);
const attempt = (page, code) => page.eval(`(${code})`);
const SAVE = "(()=>{const r=sukiStore.save(LIST);return {ok:r.ok,message:r.error?.message??null}})()";
const save = (page, list) => page.eval(SAVE.replace("LIST", JSON.stringify(list)));

const tests = [];

tests.push({
  name: "a stale list cannot put a stored card on a second customer",
  run: async ({ page }) => {
    await open(page, [jaymark(), kent()]);
    const list = await page.eval("sukiStore.read()");
    await page.eval(`sukiStore.setCardCode('j','${FIRST}')`);
    list[1].cardCode = FIRST;
    expect(await save(page, list), { ok: false, message: REFUSED }, "stale save");
    expect(await codes(page), [FIRST, null], "stored codes");
  },
});

tests.push({
  name: "a stale list cannot remove a card",
  run: async ({ page }) => {
    await open(page, [jaymark(), kent()]);
    const list = await page.eval("sukiStore.read()");
    await page.eval(`sukiStore.setCardCode('j','${FIRST}')`);
    expect((await save(page, list)).ok, true, "stale save");
    expect(await codes(page), [FIRST, null], "stored codes");
  },
});

tests.push({
  name: "two saves from one moment: the first wins and the second is refused",
  run: async ({ page }) => {
    await open(page, [jaymark(), kent()]);
    const result = await attempt(page, `(() => {
      const first = sukiStore.read();
      const second = sukiStore.read();
      first[0].cardCode = "${FIRST}";
      second[1].cardCode = "${FIRST}";
      const results = [sukiStore.save(first), sukiStore.save(second)];
      return results.map((item) => ({ ok: item.ok, message: item.error?.message ?? null }));
    })()`);
    expect(result, [{ ok: true, message: null }, { ok: false, message: REFUSED }], "results");
    expect(await codes(page), [FIRST, null], "stored codes");
  },
});

tests.push({
  name: "two real tabs: the second is refused once it can see the first",
  run: async ({ page }) => {
    await open(page, [jaymark(), kent()]);
    const other = await page.openSiblingTab();
    await other.goto("suki-reward.html");
    expect(await page.eval(`sukiStore.setCardCode('j','${FIRST}').ok`), true, "first tab");
    await other.until(`localStorage.getItem('miniMartSukis').includes('${FIRST}')`, { label: "the other tab to see the card" });
    const result = await other.eval(`(()=>{const r=sukiStore.setCardCode('k','${FIRST}');return {ok:r.ok,message:r.error?.message}})()`);
    expect(result, { ok: false, message: REFUSED }, "second tab");
  },
});

tests.push({
  name: "Add Suki refuses a card that was taken after it was captured",
  run: async ({ page }) => {
    await open(page, [jaymark(), kent()]);
    await page.eval("openAddSukiForm()");
    await page.click("#addUsbCardScan");
    await page.typeBurst(FIRST, { gap: 10 });
    await page.eval(`sukiStore.setCardCode('j','${FIRST}')`);
    await page.eval("sukiName.value='New Person';sukiName.dispatchEvent(new Event('input',{bubbles:true}));addSukiForm.requestSubmit()");
    await sleep(80);
    expect((await stored(page)).length, 2, "customers");
  },
});

tests.push({
  name: "the same card on a second customer is refused, whatever its case or spaces",
  run: async ({ page }) => {
    await open(page, [jaymark({ cardCode: "ab-1234" }), kent()]);
    for (const code of ["ab-1234", "AB-1234", " AB-1234 "]) {
      const result = await page.eval((value) => {
        const reply = sukiStore.setCardCode("k", value);
        return { ok: reply.ok, message: reply.error?.message };
      }, code);
      expect(result, { ok: false, message: REFUSED }, code);
    }
  },
});

tests.push({
  name: "a save that keeps a customer's own code still works",
  run: async ({ page }) => {
    await open(page, [jaymark({ cardCode: FIRST }), kent()]);
    const list = await page.eval("sukiStore.read()");
    list[0].phone = "0917";
    expect((await save(page, list)).ok, true, "save");
    const [saved] = await stored(page);
    expect([saved.cardCode, saved.phone], [FIRST, "0917"], "customer");
  },
});

tests.push({
  name: "changing only the name never touches the code",
  run: async ({ page }) => {
    await open(page, [jaymark({ cardCode: FIRST }), kent()]);
    const before = await raw(page);
    const list = await page.eval("sukiStore.read()");
    list[0].name = "Jaymark";
    await save(page, list);
    expect(await raw(page), before.replace("Jaymark Anit", "Jaymark"), "stored customers");
  },
});

const stuck = () => [jaymark({ cardCode: FIRST, phone: "0917", stamps: 30 }), kent({ cardCode: FIRST, stamps: 5 }), customer("z", "Zed")];

tests.push({
  name: "an old duplicate does not block edits to anyone",
  run: async ({ page }) => {
    await open(page, stuck());
    const list = await page.eval("sukiStore.read()");
    list[2].phone = "0999";
    expect((await save(page, list)).ok, true, "save");
    expect(await codes(page), [FIRST, FIRST, null], "codes left alone");
  },
});

tests.push({
  name: "a duplicate backs up the raw list once, and nothing changes",
  run: async ({ page }) => {
    await open(page, stuck());
    const before = await raw(page);
    await page.goto("suki-reward.html");
    await page.goto("index.html");
    expect(await raw(page), before, "stored customers");
    const keys = await backups(page);
    expect(keys.length, 1, "backups");
    expect(await page.eval((key) => localStorage.getItem(key), keys[0]), before, "backup value");
  },
});

tests.push({
  name: "the notice names the card, both customers, and offers a button for each",
  run: async ({ page }) => {
    await open(page, stuck());
    const notice = await page.eval(() => {
      const box = document.getElementById("cardDuplicateNotice");
      return { hidden: box.hidden, text: box.querySelector("p").textContent, buttons: [...box.querySelectorAll("button")].map((button) => button.textContent) };
    });
    expect(notice, {
      hidden: false,
      text: "The card ending 4756 is registered to Jaymark Anit and Kent. Choose who keeps it.",
      buttons: ["Keep for Jaymark Anit", "Keep for Kent"],
    }, "notice");
  },
});

tests.push({
  name: "no notice shows when every card has one owner",
  run: async ({ page }) => {
    await open(page, [jaymark({ cardCode: FIRST }), kent({ cardCode: SECOND })]);
    expect(await page.eval("document.getElementById('cardDuplicateNotice').hidden"), true, "notice hidden");
    expect(await backups(page), [], "backups");
  },
});

const pressKeep = async (page, index) => {
  await page.click("#cardDuplicateNotice button", index);
  await page.until("document.querySelector('.confirm-dialog')", { label: "the dialog" });
};

tests.push({
  name: "Decide later changes nothing",
  run: async ({ page }) => {
    await open(page, stuck());
    const before = await raw(page);
    await pressKeep(page, 1);
    await page.click(".confirm-dialog-button.is-cancel");
    await sleep(80);
    expect(await raw(page), before, "stored customers");
  },
});

tests.push({
  name: "keeping the card for one customer takes it from the other, and nothing else changes",
  run: async ({ page }) => {
    await open(page, stuck());
    const before = await raw(page);
    await pressKeep(page, 1);
    expect(await page.eval("document.querySelector('.confirm-dialog h2').textContent"), "Keep this card for Kent?", "title");
    await page.click(".confirm-dialog-button.is-confirm");
    await sleep(100);
    expect(await raw(page), before.replace(`,"cardCode":"${FIRST}"`, ""), "stored customers");
    expect(await codes(page), [null, FIRST, null], "codes");
    expect(await page.eval("document.getElementById('cardDuplicateNotice').hidden"), true, "notice hidden");
    expect(await page.eval(`sukiStore.findByCardCode('${FIRST}')?.name`), "Kent", "owner");
  },
});

tests.push({
  name: "three customers on one card are all offered",
  run: async ({ page }) => {
    await open(page, [jaymark({ cardCode: FIRST }), kent({ cardCode: FIRST }), customer("z", "Zed", { cardCode: FIRST })]);
    expect(await page.eval("document.querySelector('#cardDuplicateNotice p').textContent"),
      "The card ending 4756 is registered to Jaymark Anit, Kent and Zed. Choose who keeps it.", "notice");
  },
});

tests.push({
  name: "codes differing only in case or spaces count as a duplicate",
  run: async ({ page }) => {
    await open(page, [jaymark({ cardCode: "ab-1234" }), kent({ cardCode: " AB-1234 " })]);
    expect(await page.eval("document.getElementById('cardDuplicateNotice').hidden"), false, "notice hidden");
  },
});

const sellCoke = async (page) => {
  await page.eval("addProductToCart(window.miniMartDB.products().find(p=>p.name==='Coke 1.5L'));amountGiven.value='100';updatePayment();");
  await page.eval("document.getElementById('sellButton').click();document.getElementById('confirmCheckoutSale').click()");
  await sleep(80);
};

tests.push({
  name: "an ambiguous card at Checkout selects nobody, and a sale earns no points",
  run: async ({ page }) => {
    await open(page, stuck(), "index.html");
    await page.eval("addProductToCart(window.miniMartDB.products().find(p=>p.name==='Coke 1.5L'))");
    await page.typeBurst(FIRST, { gap: 10 });
    expect(await page.eval("selectedSukiId"), "", "customer");
    expect(await page.eval("document.getElementById('checkoutSukiScanStatus').textContent"), AMBIGUOUS, "message");
    await page.eval("cart.clear();renderCart()");
    await sellCoke(page);
    expect((await stored(page)).map((suki) => suki.stamps), [30, 5, 12], "points");
  },
});

tests.push({
  name: "an ambiguous card clears a customer who was already selected",
  run: async ({ page }) => {
    await open(page, [...stuck(), customer("x", "Xena")], "index.html");
    await page.eval("addProductToCart(window.miniMartDB.products()[0]);selectedSukiId='x';updateSukiCheckoutInfo()");
    await page.typeBurst(FIRST, { gap: 10 });
    expect(await page.eval("selectedSukiId"), "", "customer");
  },
});

tests.push({
  name: "an ambiguous card in Checkout card mode selects nobody and offers no attach",
  run: async ({ page }) => {
    await open(page, stuck(), "index.html");
    await page.eval("addProductToCart(window.miniMartDB.products()[0])");
    await page.click("#checkoutSukiScanButton");
    await page.typeBurst(FIRST, { gap: 10 });
    expect(await page.eval("[selectedSukiId,document.getElementById('checkoutUsbUnknown').hidden,document.getElementById('checkoutSukiScanStatus').textContent]"), ["", true, AMBIGUOUS], "state");
  },
});

tests.push({
  name: "an ambiguous card on the Scan tab shows nobody",
  run: async ({ page }) => {
    await open(page, stuck());
    await page.typeBurst(FIRST, { gap: 10 });
    expect(await page.eval("[scanTitle.textContent,scanStatus.textContent,detailModal.hidden]"), ["Card needs attention", AMBIGUOUS, true], "state");
  },
});

tests.push({
  name: "a card with one owner still works beside a duplicate",
  run: async ({ page }) => {
    await open(page, [jaymark({ cardCode: FIRST }), kent({ cardCode: FIRST }), customer("z", "Zed", { cardCode: SECOND })], "index.html");
    await page.eval("addProductToCart(window.miniMartDB.products()[0])");
    await page.typeBurst(SECOND, { gap: 10 });
    expect(await page.eval("selectedSukiId"), "z", "customer");
  },
});

tests.push({
  name: "a restore with a duplicate warns and enters the resolve flow",
  run: async ({ page }) => {
    await page.seed({});
    await page.goto("settings.html");
    const data = await page.eval("readBackupData()");
    data.customers = [jaymark({ cardCode: FIRST }), kent({ cardCode: FIRST })];
    await page.eval((backup) => { showRestorePreview(backup, "old.json"); }, data);
    const preview = await page.eval("document.getElementById('backupRestorePreviewText').textContent");
    if (!preview.includes("Warning: the card ending 4756 is registered to Jaymark Anit and Kent.")) throw new Error(preview);
    await page.eval((backup) => { restoreBackupData(backup); }, data);
    await page.goto("suki-reward.html");
    expect(await page.eval("document.getElementById('cardDuplicateNotice').hidden"), false, "notice hidden");
    expect((await backups(page)).length, 1, "backups");
    await page.typeBurst(FIRST, { gap: 10 });
    expect(await page.eval("scanStatus.textContent"), AMBIGUOUS, "a tap");
  },
});

tests.push({
  name: "leading zeros survive save, reload, backup and restore",
  run: async ({ page }) => {
    await open(page, [jaymark(), kent()]);
    await page.eval(`sukiStore.setCardCode('j','${FIRST}');sukiStore.setCardCode('k','${SECOND}')`);
    await page.goto("settings.html");
    const data = await page.eval("readBackupData()");
    expect(data.customers.map((suki) => suki.cardCode), [FIRST, SECOND], "backup");
    await page.eval((backup) => { restoreBackupData(backup); }, JSON.parse(JSON.stringify(data)));
    await page.goto("suki-reward.html");
    expect(await codes(page), [FIRST, SECOND], "after restore");
    expect(await page.eval(`typeof JSON.parse(localStorage.miniMartSukis)[0].cardCode`), "string", "type");
    expect(await page.eval(`sukiStore.findByCardCode('${SECOND}')?.name`), "Kent", "lookup");
    expect(await page.eval("sukiStore.findByCardCode('33194756')"), null, "a code without its zeros is a different code");
  },
});

for (const [name, file] of [["Checkout", "index"], ["Suki Rewards", "suki-reward"]]) {
  tests.push({
    name: `${name} has no console errors with a duplicate stored`,
    run: async ({ page, server }) => {
      await open(page, stuck(), `${file}.html`);
      await page.typeBurst(FIRST, { gap: 10 });
      const problems = page.problems.filter((problem) => !BLOCKED_HOSTS.some((host) => `${problem.text} ${problem.url || ""}`.includes(host)));
      expect(problems, [], "problems");
      expect(server.requests.filter(({ status }) => status >= 400), [], "failed requests");
    },
  });
}

module.exports = { tests };
