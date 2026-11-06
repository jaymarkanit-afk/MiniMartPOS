#!/usr/bin/env node
"use strict";
// Saves pictures of the dialogs and the card reader states: node tests/screenshots.js
const fs = require("fs");
const path = require("path");
const { launch } = require("./lib/chrome");
const { createServer } = require("./lib/server");
const { Page, sleep } = require("./lib/cdp");

const OUTPUT = path.join(__dirname, "screenshots");
const DESKTOP = { width: 1264, height: 805 };
const PHONE = { width: 390, height: 844 };
const CARD = "0004521977";
const BASE = { phone: "", joined: "2026-01-02", nfcId: "", stamps: 0, active: true, history: [] };
const defaultCustomers = [
  { ...BASE, id: "a", name: "Ana", cardCode: CARD, stamps: 12 },
  { ...BASE, id: "b", name: "Ben" },
];
const closeDetail = "closeModal(detailModal)";
const dialogOpen = (page) => page.until("document.querySelector('.confirm-dialog')", { label: "the dialog" });
const openTestPanel = (page) => page.eval(() => {
  const button = document.getElementById("usbReaderTest");
  const panel = button.closest("[role='tabpanel']");
  document.querySelector(`.settings-tab[data-settings-panel="${panel.id}"]`).click();
  button.click();
});
const OPEN_ALERT = `void alertDialog({
  title: "This unit can't be changed",
  message: "This product has stock or sales history. Create a new product if you need a different unit; existing inventory cannot be converted safely.",
})`;

const SHOTS = [
  { file: "reset-section-light.png", theme: "light", open: async (page) => { await page.click("#resetStoreInfo"); await dialogOpen(page); } },
  { file: "reset-section-dark.png", theme: "dark", open: async (page) => { await page.click("#resetStoreInfo"); await dialogOpen(page); } },
  { file: "reset-section-phone.png", theme: "light", size: PHONE, open: async (page) => { await page.click("#resetStoreInfo"); await dialogOpen(page); } },
  { file: "alert-light.png", theme: "light", open: async (page) => { await page.eval(OPEN_ALERT); await dialogOpen(page); } },
  { file: "alert-dark.png", theme: "dark", open: async (page) => { await page.eval(OPEN_ALERT); await dialogOpen(page); } },
  { file: "scan-tab-waiting.png", url: "suki-reward.html", open: async () => {} },
  {
    file: "all-sukis-badges.png",
    url: "suki-reward.html",
    customers: [
      { ...BASE, id: "a", name: "USB only", cardCode: "0033194756" },
      { ...BASE, id: "b", name: "Phone only", nfcId: "AA:BB" },
      { ...BASE, id: "c", name: "Both cards", cardCode: "0016814852", nfcId: "CC:DD" },
      { ...BASE, id: "d", name: "No card" },
    ],
    open: (page) => page.eval("document.getElementById('allSukisTab').click()"),
  },
  {
    file: "duplicate-card-notice.png",
    url: "suki-reward.html",
    customers: [
      { ...BASE, id: "a", name: "Jaymark Anit", cardCode: "0033194756" },
      { ...BASE, id: "b", name: "Kent", cardCode: "0033194756" },
    ],
    open: async () => {},
  },
  {
    file: "scan-tab-after-good-tap.png",
    url: "suki-reward.html",
    open: async (page) => {
      await page.typeBurst(CARD, { gap: 10 });
      await page.eval(closeDetail);
    },
  },
  { file: "scan-tab-unknown-card.png", url: "suki-reward.html", open: (page) => page.typeBurst("A1B2C3D4", { gap: 10 }) },
  {
    file: "checkout-card-mode.png",
    url: "index.html",
    open: async (page) => {
      await page.eval("addProductToCart(window.miniMartDB.products()[0])");
      await page.click("#checkoutSukiScanButton");
      await page.eval("document.getElementById('checkoutSukiScanButton').scrollIntoView({block:'center'})");
    },
  },
  {
    file: "test-panel-accepted-and-rejected.png",
    open: async (page) => {
      await openTestPanel(page);
      await page.typeBurst("1234", { gap: 80 });
      await page.typeBurst(CARD, { gap: 10 });
      await page.eval("document.getElementById('usbReaderTaps').scrollIntoView({block:'center'})");
    },
  },
];

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const server = createServer();
  await server.start();
  const chrome = await launch();
  try {
    for (const { file, url = "settings.html", size = DESKTOP, theme = "light", customers = defaultCustomers, open } of SHOTS) {
      const page = await Page.open(chrome.cdp, server);
      await page.send("Emulation.setDeviceMetricsOverride", { ...size, deviceScaleFactor: 1, mobile: false });
      await page.seed({ miniMartSettings: { theme, storeName: "My Corner Store" }, miniMartSukis: customers });
      await page.goto(url, 600);
      await open(page);
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
