#!/usr/bin/env node
"use strict";
// Saves pictures of the dialogs: node tests/screenshots.js
const fs = require("fs");
const path = require("path");
const { launch } = require("./lib/chrome");
const { createServer } = require("./lib/server");
const { Page, sleep } = require("./lib/cdp");

const OUTPUT = path.join(__dirname, "screenshots");
const DESKTOP = { width: 1264, height: 805 };
const PHONE = { width: 390, height: 844 };
const SHOTS = [
  { file: "reset-section-light.png", size: DESKTOP, theme: "light", open: "reset" },
  { file: "reset-section-dark.png", size: DESKTOP, theme: "dark", open: "reset" },
  { file: "reset-section-phone.png", size: PHONE, theme: "light", open: "reset" },
  { file: "alert-light.png", size: DESKTOP, theme: "light", open: "alert" },
  { file: "alert-dark.png", size: DESKTOP, theme: "dark", open: "alert" },
];
const OPENERS = {
  reset: async (page) => page.click("#resetStoreInfo"),
  alert: (page) => page.eval(`void alertDialog({
    title: "This unit can't be changed",
    message: "This product has stock or sales history. Create a new product if you need a different unit; existing inventory cannot be converted safely.",
  })`),
};

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const server = createServer();
  await server.start();
  const chrome = await launch();
  try {
    for (const { file, size, theme, open } of SHOTS) {
      const page = await Page.open(chrome.cdp, server);
      await page.send("Emulation.setDeviceMetricsOverride", { ...size, deviceScaleFactor: 1, mobile: false });
      await page.seed({ miniMartSettings: { theme, storeName: "My Corner Store" } });
      await page.goto("settings.html", 600);
      await OPENERS[open](page);
      await page.until("document.querySelector('.confirm-dialog')", { label: "the dialog" });
      await sleep(250);
      const { data } = await page.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(OUTPUT, file), Buffer.from(data, "base64"));
      console.log(path.join(OUTPUT, file));
      await page.close();
    }
  } finally {
    await chrome.close();
    await server.stop();
  }
}

main().then(() => process.exit(0), (error) => {
  console.error(error.message);
  process.exit(2);
});
