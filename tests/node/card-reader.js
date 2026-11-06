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
        await page.typeBurst(code, { gap });
        const tap = await lastTap(page);
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
      if (gap < 120) {
        expect(tap.lines.at(-1), "Works as a card: no. It was too slow to be a reader.", "verdict");
      } else {
        expect(worksAsCard(tap), false, "recognized");
      }
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
    const average = Number(tap.lines[2].match(/([\d.]+) ms/)[1]);
    if (average < 15 || average > 30) throw new Error(`Average gap was ${average}`);
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

module.exports = { tests };
