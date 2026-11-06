"use strict";
// Backups and restore. Expected values come from the backup brief: all 13 sections,
// store-timezone filenames, all-or-nothing restore, automatic backup first.
const status = () => text("backupStatus");
const snap = () => JSON.stringify(
  Object.keys(localStorage)
    .filter((key) => key !== "miniMartLastBackup" && key !== "miniMartStockHistoryExport")
    .sort()
    .map((key) => [key, localStorage.getItem(key)]),
);
const NOW = new Date().toISOString();
const SECTIONS = {
  products: "miniMartProducts",
  sales: "miniMartSales",
  categories: "miniMartCategories",
  categoryIcons: "miniMartCategoryIcons",
  categoryUnits: "miniMartCategoryUnits",
  deletedProducts: "miniMartDeletedProducts",
  favoriteProducts: "miniMartFavoriteProducts",
  customers: "miniMartSukis",
  settings: "miniMartSettings",
  inventoryAdjustments: "miniMartInventoryAdjustments",
  shiftHistory: "miniMartShiftHistory",
  currentShift: "miniMartCurrentShift",
  heldCarts: "miniMartHeldCarts",
};
const seedBusiness = () => {
  L("miniMartProducts", [{ name: "Rice", category: "Grains", price: 50, costPrice: 40, stock: 20, unit: "kg", id: "p1" }]);
  L("miniMartSales", [{ id: "t1", date: NOW, items: [{ name: "Rice", price: 50, quantity: 1 }], total: 50, status: "completed" }]);
  L("miniMartCategories", ["Grains"]);
  L("miniMartCategoryIcons", { Grains: "riceGrains" });
  L("miniMartCategoryUnits", { Grains: "kg" });
  L("miniMartDeletedProducts", ["Coke 1.5L"]);
  L("miniMartFavoriteProducts", ["Rice"]);
  L("miniMartSukis", [{ id: "s1", name: "Ana", stamps: 3, rewardBalance: 3, history: [] }]);
  L("miniMartInventoryAdjustments", [{ product: "Rice", adjustment: 1, previousStock: 19, stockAfter: 20, reason: "x", date: NOW }]);
  L("miniMartShiftHistory", [{ id: "S0", openingCash: 1000, closingCash: 1200 }]);
  L("miniMartCurrentShift", { id: "S1", openingCash: 500, sales: 1, cashSales: 50 });
  L("miniMartHeldCarts", [{ id: "H1", createdAt: NOW, items: [{ name: "Rice", price: 50, quantity: 2 }] }]);
  L("miniMartCheckoutDraft", { version: 1, updatedAt: NOW, items: [] });
  L("miniMartRecentProducts", ["Rice"]);
  L("miniMartProducts__corrupt_1", [{}]);
};
const pick = async (content, name = "backup.json") => {
  const body = typeof content === "string" ? content : JSON.stringify(content);
  const w = F.contentWindow;
  const transfer = new w.DataTransfer();
  transfer.items.add(new w.File([body], name, { type: "application/json" }));
  const input = $("restoreBackup");
  input.files = transfer.files;
  input.dispatchEvent(new w.Event("change", { bubbles: true }));
  await sleep(150);
};
const manualBackup = async () => {
  $("downloadBackup").click();
  await sleep(250);
  const download = dl.at(-1);
  await download?.ready;
  return download;
};
const confirmRestore = async (wait = 1700) => {
  $("confirmRestoreBackup").click();
  await sleep(wait);
};
const startReset = async () => {
  $("openResetData").click();
  $("resetConfirmText").value = "RESET";
  $("confirmResetData").disabled = false;
  $("confirmResetData").click();
  await sleep(250);
};
let cachedFile = null;
const baseFile = async () => {
  if (!cachedFile) {
    await fresh();
    seedBusiness();
    L("miniMartSettings", { timezone: "Asia/Manila" });
    await go("settings.html");
    cachedFile = (await manualBackup()).text;
  }
  return cachedFile;
};

test("clicking Backup downloads a complete file and records the date", async () => {
  await fresh();
  seedBusiness();
  L("miniMartSettings", { timezone: "Asia/Manila" });
  await go("settings.html");
  eq(localStorage.getItem("miniMartLastBackup"), null, "last backup before");
  const download = await manualBackup();
  ok(download, "No file was downloaded");
  const file = JSON.parse(download.text);
  eq(download.name, `mini-mart-pos-backup-${storeDate("Asia/Manila")}.json`, "filename");
  eq(status(), "Backup downloaded.", "status");
  eq(file.version, 2, "version");
  eq(Object.keys(file.data).sort(), Object.keys(SECTIONS).sort(), "sections");
  eq(file.data.heldCarts.length, 1, "held carts");
  eq(file.data.shiftHistory.length, 1, "shift history");
  eq(file.data.currentShift.id, "S1", "current shift");
  eq(file.data.categoryUnits, { Grains: "kg" }, "category units");
  eq(localStorage.getItem("miniMartLastBackup"), file.exportedAt, "last backup date");
  ok(text("backupSummary").startsWith("17 products · 1 sales · 1 customers · 17 stock adjustments · Last backup "), `summary: ${text("backupSummary")}`);
  ["corrupt", "Draft", "Session", "LocalDemo", "Recent"].forEach((secret) => {
    ok(!download.text.includes(secret), `Backup file contains "${secret}"`);
  });
});

test("backup filename uses the store timezone, not the computer's", async () => {
  for (const timezone of ["Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
    await fresh();
    L("miniMartSettings", { timezone });
    await go("settings.html");
    eq(e("todayFilename('mini-mart-pos-backup','json')"), `mini-mart-pos-backup-${storeDate(timezone)}.json`, timezone);
  }
});

test("restore into an empty app shows a preview, backs up first, restores every section", async () => {
  const file = await baseFile();
  await fresh();
  await go("settings.html");
  await pick(file, "full.json");
  ok(!$("backupRestorePreview").hidden, "Preview is hidden");
  eq(localStorage.getItem("miniMartHeldCarts"), null, "written before confirm");
  eq(
    text("backupRestorePreviewText"),
    "full.json: 17 products, 1 sales, 1 categories, 1 customers, 17 stock adjustments, 1 closed shifts, 1 held carts, and settings. A safety backup of your current data downloads first.",
    "preview",
  );
  $("confirmRestoreBackup").click();
  await sleep(200);
  const safety = dl.at(-1);
  await safety?.ready;
  await sleep(1500);
  ok(/^mini-mart-pos-pre-restore-backup-\d{4}-\d{2}-\d{2}\.json$/.test(safety?.name), `Safety file: ${safety?.name}`);
  eq(JSON.parse(safety.text).version, 2, "safety version");
  const data = JSON.parse(file).data;
  const different = Object.keys(SECTIONS)
    .filter((name) => name !== "settings")
    .filter((name) => JSON.stringify(JSON.parse(localStorage.getItem(SECTIONS[name]))) !== JSON.stringify(data[name]));
  // Stock history is the one section that grows: a restore appends its own entries.
  eq(different, ["inventoryAdjustments"], "sections that differ from the file");
  await go("index.html");
  eq(e("resumeHeldCart();cart.get('Rice')?.quantity"), 2, "held cart after restore");
});

test("restoring a backup with no open shift clears the open shift", async () => {
  const file = JSON.parse(await baseFile());
  await fresh();
  seedBusiness();
  await go("settings.html");
  file.data.currentShift = null;
  await pick(file);
  await confirmRestore();
  eq(localStorage.getItem("miniMartCurrentShift"), null, "current shift");
});

test("restore keeps existing stock history and appends restore entries", async () => {
  await fresh();
  seedBusiness();
  await go("settings.html");
  const before = J("miniMartInventoryAdjustments");
  await pick({
    format: "MiniMartPOS backup",
    version: 1,
    data: { products: [{ name: "Old", category: "X", price: 1, stock: 1 }], sales: [], categories: ["X"], customers: [], settings: {} },
  }, "old.json");
  await confirmRestore();
  const history = J("miniMartInventoryAdjustments");
  eq(history.slice(0, before.length), before, "original history");
  eq(
    history.slice(before.length, before.length + 2).map((entry) => [entry.product, entry.previousStock, entry.stockAfter, entry.reason]),
    [["Old", 0, 1, "restore"], ["Rice", 20, 0, "restore"]],
    "first restore entries",
  );
});

test("an old version 1 backup restores and leaves sections it lacks unchanged", async () => {
  await fresh();
  seedBusiness();
  await go("settings.html");
  await pick({
    format: "MiniMartPOS backup",
    version: 1,
    exportedAt: "2020-01-01T00:00:00.000Z",
    data: { products: [{ name: "Old", category: "X", price: 1, stock: 1 }], sales: [], categories: ["X"], categoryIcons: [], deletedProducts: [], customers: [], settings: { storeName: "Old Store" } },
  }, "old.json");
  eq(status(), "Review the preview, then restore or cancel.", "status");
  eq(
    text("backupRestorePreviewText"),
    "old.json: 1 products, 0 sales, 1 categories, 0 customers, 0 stock adjustments, 0 closed shifts, 0 held carts, and settings. A safety backup of your current data downloads first. Not in this file, so left unchanged: categoryUnits, favoriteProducts, inventoryAdjustments, shiftHistory, currentShift, heldCarts.",
    "preview",
  );
  const keep = ["miniMartHeldCarts", "miniMartCurrentShift", "miniMartShiftHistory", "miniMartCategoryUnits", "miniMartFavoriteProducts"];
  const before = keep.map((key) => localStorage.getItem(key));
  const historyBefore = J("miniMartInventoryAdjustments");
  await confirmRestore();
  keep.forEach((key, index) => eq(localStorage.getItem(key), before[index], key));
  eq(J("miniMartInventoryAdjustments").slice(0, historyBefore.length), historyBefore, "history kept");
  ok(J("miniMartProducts").some((product) => product.name === "Old"), "Restored product is missing");
  eq(J("miniMartSettings").storeName, "Old Store", "store name");
  eq(localStorage.getItem("miniMartCategoryIcons"), "{}", "category icons");
  ok(localStorage.getItem("miniMartLastBackup") !== "2020-01-01T00:00:00.000Z", "Last backup date came from the file");
});

test("broken backup files are rejected and nothing is written", async () => {
  const base = JSON.parse(await baseFile());
  await fresh();
  seedBusiness();
  await go("settings.html");
  const before = snap();
  const change = (edit) => {
    const copy = JSON.parse(JSON.stringify(base));
    edit(copy);
    return copy;
  };
  const cases = {
    "products is text": [change((c) => { c.data.products = "oops"; }), 'Invalid backup file: the "products" section has the wrong format. Nothing was changed.'],
    "products are numbers": [change((c) => { c.data.products = [1, 2]; }), 'Invalid backup file: the "products" section has the wrong format. Nothing was changed.'],
    "held carts is text": [change((c) => { c.data.heldCarts = "x"; }), 'Invalid backup file: the "heldCarts" section has the wrong format. Nothing was changed.'],
    "shift is a list": [change((c) => { c.data.currentShift = []; }), 'Invalid backup file: the "currentShift" section has the wrong format. Nothing was changed.'],
    "units is a list": [change((c) => { c.data.categoryUnits = []; }), 'Invalid backup file: the "categoryUnits" section has the wrong format. Nothing was changed.'],
    "future version": [change((c) => { c.version = 99; }), "Invalid backup file: it was made by a newer version of this app. Nothing was changed."],
    "sales missing": [change((c) => { delete c.data.sales; }), "Nothing was changed."],
    "wrong format": [{ hello: 1 }, "Nothing was changed."],
  };
  for (const [name, [content, message]] of Object.entries(cases)) {
    await pick(content);
    has(status(), message, name);
    ok($("backupRestorePreview").hidden, `${name}: preview shown`);
    ok($("backupStatus").className.includes("error"), `${name}: not shown as an error`);
  }
  await pick("{not json");
  has(status(), "Nothing was changed.", "not JSON");
  eq(snap() === before, true, "storage unchanged");
});

test("a restore that fails part way puts every key back", async () => {
  const file = JSON.parse(await baseFile());
  await fresh();
  seedBusiness();
  await go("settings.html");
  const before = snap();
  file.data.products = [{ name: "NEW", category: "Z", price: 1, stock: 1 }];
  file.data.heldCarts = [{ id: "NEW" }];
  await pick(file);
  failWrites((key, value) => key === "miniMartHeldCarts" && String(value).includes("NEW"));
  await confirmRestore();
  eq(status(), "Restore failed, and your data was put back as it was. Could not save. Browser storage is full. Export your data and clear old records.", "status");
  ok($("backupStatus").className.includes("error"), "Not shown as an error");
  eq(snap() === before, true, "all keys rolled back");
  has(dl.at(-1)?.name, "mini-mart-pos-pre-restore-backup-", "safety file");
});

test("reset downloads a backup first, then erases", async () => {
  await fresh();
  seedBusiness();
  await go("settings.html");
  await startReset();
  const download = dl.at(-1);
  await download?.ready;
  has(download?.name, "mini-mart-pos-pre-reset-backup-", "file");
  eq(JSON.parse(download.text).data.sales.length, 1, "sales in the file");
  eq(J("miniMartSales").length, 0, "sales after reset");
});

test("reset stops and erases nothing if the automatic backup fails", async () => {
  await fresh();
  seedBusiness();
  await go("settings.html");
  const before = snap();
  const lastBackup = localStorage.getItem("miniMartLastBackup");
  F.contentWindow.URL.createObjectURL = () => { throw new Error("blocked"); };
  await startReset();
  eq(text("resetDataStatus"), "Automatic backup failed, so nothing was erased. blocked", "message");
  eq(snap() === before, true, "storage unchanged");
  eq(localStorage.getItem("miniMartLastBackup"), lastBackup, "last backup");
});

test("reset stops if a section cannot be read", async () => {
  await fresh();
  seedBusiness();
  localStorage.setItem("miniMartHeldCarts", "{bad");
  await go("settings.html");
  const before = snap();
  await startReset();
  eq(text("resetDataStatus"), "Automatic backup failed, so nothing was erased. Could not read: heldCarts.", "message");
  eq(snap() === before, true, "storage unchanged");
  eq(dl.length, 0, "downloads");
});

test("restore stops and changes nothing if the automatic backup fails", async () => {
  const file = await baseFile();
  await fresh();
  seedBusiness();
  await go("settings.html");
  const before = snap();
  const lastBackup = localStorage.getItem("miniMartLastBackup");
  await pick(file);
  F.contentWindow.URL.createObjectURL = () => { throw new Error("blocked"); };
  await confirmRestore(300);
  eq(status(), "Automatic backup failed, so the restore was stopped. Nothing was changed. blocked", "message");
  eq(snap() === before, true, "storage unchanged");
  eq(localStorage.getItem("miniMartLastBackup"), lastBackup, "last backup");
  ok($("backupRestorePreview").hidden, "Preview still shown");
});

test("a failed backup keeps the last date, and a partial backup says what it left out", async () => {
  await fresh();
  seedBusiness();
  await go("settings.html");
  const lastBackup = localStorage.getItem("miniMartLastBackup");
  const real = F.contentWindow.URL.createObjectURL;
  F.contentWindow.URL.createObjectURL = () => { throw new Error("blocked"); };
  $("downloadBackup").click();
  await sleep(200);
  eq(status(), "Could not create the backup file. Please try again.", "failure message");
  eq(localStorage.getItem("miniMartLastBackup"), lastBackup, "last backup");
  F.contentWindow.URL.createObjectURL = real;
  localStorage.setItem("miniMartHeldCarts", "{bad");
  const partial = JSON.parse((await manualBackup()).text);
  eq(status(), "Backup downloaded without these unreadable sections: heldCarts.", "partial message");
  eq(partial.omitted, ["heldCarts"], "omitted");
  ok(!("heldCarts" in partial.data), "Partial file has held carts");
  await go("settings.html");
  await pick(partial);
  ok(!$("backupRestorePreview").hidden, "Partial file was refused");
  await confirmRestore(300);
  eq(status(), "Automatic backup failed, so the restore was stopped. Nothing was changed. Could not read: heldCarts.", "restore message");
});

test("sales, product and customer exports work in Excel and PDF", async () => {
  await fresh();
  seedBusiness();
  L("miniMartSettings", { storeName: "Test Store", timezone: "Asia/Manila" });
  await go("settings.html");
  const change = (id) => $(id).dispatchEvent(new F.contentWindow.Event("change", { bubbles: true }));
  for (const type of ["sales", "products", "customers"]) {
    $("reportExportData").value = type;
    change("reportExportData");
    $("salesRange").value = "all";
    change("salesRange");
    $("exportExcel").click();
    await sleep(500);
    eq(text("reportExportStatus"), "Excel report downloaded.", `${type} Excel`);
    $("exportPdf").click();
    await sleep(900);
    eq(text("reportExportStatus"), "PDF report downloaded.", `${type} PDF`);
  }
  const date = storeDate("Asia/Manila");
  eq(e("[reportFilename('sales','xlsx'),reportFilename('sales','pdf')]"), [`TestStore_Sales_${date}.xlsx`, `TestStore_Sales_${date}.pdf`], "filenames");
});

test("the page reloads cleanly after a restore", async () => {
  const file = await baseFile();
  await fresh();
  seedBusiness();
  await go("settings.html");
  await pick(file, "race.json");
  await confirmRestore(1800);
  ok($("backupStatus"), "Settings page did not come back");
});
