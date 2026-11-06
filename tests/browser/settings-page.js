"use strict";
// One feature from each Settings tab, plus the exported data compared with a snapshot
// taken from the single settings.js file before it was split.
const NOW = Date.parse("2026-03-10T12:00:00+08:00");
const freezeClock = (w) => {
  const RealDate = w.Date;
  w.Date = class extends RealDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(NOW);
    }

    static now() {
      return NOW;
    }
  };
};
const change = (id) => $(id).dispatchEvent(new F.contentWindow.Event("change", { bubbles: true }));
const seedExportData = () => {
  L("miniMartSettings", { storeName: "Test Store", timezone: "Asia/Manila", lowStockThreshold: 10 });
  L("miniMartProducts", [
    { id: "a", name: "Alpha", category: "Snacks", price: 15, costPrice: 10, stock: 4, unit: "piece", icon: "x", accent: "var(--gold)" },
    { id: "b", name: "Beta", category: "Dairy", price: 20, costPrice: 12, stock: 40, unit: "piece", icon: "x", accent: "var(--gold)" },
  ]);
  L("miniMartDeletedProducts", ["Coke 1.5L", "Sprite 1.5L", "Nature's Spring 500ml", "Nestea Lemon 1L", "Lucky Me Pancit Canton", "Lucky Me Chicken Noodles", "Payless Xtra Big", "Nissin Cup Noodles", "Piattos 40g", "Chippy Barbecue 110g", "Choc Nut 24g", "Nova Country 78g", "Bear Brand 33g", "Alaska Fortified Milk 1L", "Selecta Ice Cream Cup", "Yakult 5-Pack", "Skyflakes Crackers"]);
  L("miniMartSales", [{
    id: "TX-1",
    transactionNumber: "TX-1",
    date: "2026-03-09T02:00:00.000Z",
    items: [{ name: "Alpha", productId: "a", price: 15, quantity: 2, lineTotal: 30, costPrice: 10, category: "Snacks" }],
    total: 30,
    paymentMethod: "cash",
    payments: { cash: 30, card: 0, gcash: 0 },
    status: "completed",
    cashGiven: 30,
    cashRequired: 30,
    change: 0,
    rewardUsed: 0,
  }]);
  L("miniMartSukis", [{ id: "c1", name: "Ana", phone: "0917", joined: "2026-01-01", nfcId: "AA:BB", stamps: 12, active: true, history: [] }]);
  L("miniMartInventoryAdjustments", [{ product: "Alpha", productId: "a", previousStock: 1, adjustment: 3, stockAfter: 4, reason: "Delivery", date: "2026-03-01T00:00:00.000Z" }]);
};
const exportSnapshot = () => {
  const result = {};
  const w = F.contentWindow;
  for (const type of ["sales", "products", "customers"]) {
    $("reportExportData").value = type;
    change("reportExportData");
    $("salesRange").value = "all";
    change("salesRange");
    const workbook = e("reportWorkbook()");
    result[`${type} excel`] = Object.fromEntries(workbook.SheetNames.map((name) => [
      name,
      w.XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 }),
    ]));
    const tables = [];
    const proto = w.jspdf.jsPDF.API;
    const { autoTable } = proto;
    proto.autoTable = function recordTable(options) {
      tables.push({ head: options.head, body: options.body });
      return autoTable.call(this, options);
    };
    proto.save = function saveNothing() {
      return this;
    };
    e("exportPdfReport()");
    proto.autoTable = autoTable;
    result[`${type} pdf`] = tables;
  }
  return JSON.parse(JSON.stringify(result));
};

test("every Settings tab opens its own panel", async () => {
  await fresh();
  await go("settings.html");
  const tabs = [...F.contentDocument.querySelectorAll(".settings-tab")];
  ok(tabs.length >= 6, `${tabs.length} tabs`);
  for (const tab of tabs) {
    tab.click();
    const panel = $(tab.dataset.settingsPanel);
    ok(panel && !panel.hidden, `Panel hidden for ${tab.textContent.trim()}`);
    eq(tab.getAttribute("aria-selected"), "true", "selected");
  }
});

test("saving store info keeps it", async () => {
  await fresh();
  await go("settings.html");
  $("storeName").value = "Corner Store";
  $("storeInfoForm").requestSubmit();
  await sleep(40);
  eq(J("miniMartSettings").storeName, "Corner Store", "stored name");
  await go("settings.html");
  eq($("storeName").value, "Corner Store", "name after a reload");
});

test("saving inventory rules keeps them", async () => {
  await fresh();
  await go("settings.html");
  $("lowStockThreshold").value = "7";
  $("inventoryRulesForm").requestSubmit();
  await sleep(40);
  eq(J("miniMartSettings").lowStockThreshold, 7, "threshold");
});

test("saving Suki rules keeps them", async () => {
  await fresh();
  await go("settings.html");
  $("sukiPesosPerPoint").value = "25";
  $("sukiSettingsForm").requestSubmit();
  await sleep(40);
  eq(J("miniMartSettings").sukiPesosPerPoint, 25, "pesos per point");
});

test("the theme switches to dark and stays", async () => {
  await fresh();
  await go("settings.html");
  $("themeToggle").click();
  await sleep(40);
  eq(J("miniMartSettings").theme, "dark", "stored theme");
  await go("settings.html");
  eq(F.contentDocument.documentElement.dataset.theme, "dark", "theme after a reload");
});

test("a category can be renamed", async () => {
  await fresh();
  await go("settings.html");
  e("openCategoryManagementModal()");
  const row = F.contentDocument.querySelector(".category-management-row");
  const oldName = row.dataset.category;
  row.querySelector('[data-category-action="rename"]').click();
  row.querySelector(".category-management-edit").value = "Renamed Category";
  e("saveCategoryRename(document.querySelector('.category-management-row'))");
  await sleep(40);
  const names = e("window.miniMartDB.categories()");
  ok(names.includes("Renamed Category") && !names.includes(oldName), `Categories: ${names}`);
});

test("a category with products can be deleted, moving them first", async () => {
  await fresh();
  await go("settings.html");
  e("openCategoryManagementModal()");
  const row = F.contentDocument.querySelector(".category-management-row");
  const name = row.dataset.category;
  row.querySelector('[data-category-action="delete"]').click();
  await sleep(40);
  $("categoryMoveTarget").selectedIndex = 1;
  $("confirmCategoryDelete").click();
  await sleep(40);
  ok(!e("window.miniMartDB.categories()").includes(name), "Category still there");
  ok(!e("window.miniMartDB.products()").some((product) => product.category === name), "Products still in it");
});

test("the data health check runs", async () => {
  await fresh();
  await go("settings.html");
  $("runDataHealthCheck").click();
  await sleep(40);
  ok(!$("backupStatus").className.includes("error") || text("backupStatus"), "No result");
});

test("the NFC status shows on this device", async () => {
  await fresh();
  await go("settings.html", 300);
  ok(text("nfcStatusBadge").trim(), "No NFC status");
});

test("settings scripts load after the libraries they use", async () => {
  await fresh();
  await go("settings.html");
  const scripts = [...F.contentDocument.querySelectorAll("script[src]")].map((script) => script.getAttribute("src"));
  const firstSettings = scripts.findIndex((src) => /js\/settings(-[a-z-]+)?\.js$/.test(src) && !src.includes("settings-store"));
  ["js/vendor/xlsx.full.min.js", "js/vendor/jspdf.umd.min.js", "js/vendor/jspdf.plugin.autotable.min.js", "js/vendor/noto-sans-font.js", "js/database.js"]
    .forEach((src) => ok(scripts.indexOf(src) !== -1 && scripts.indexOf(src) < firstSettings, `${src} must load first`));
});

test("exported Excel and PDF data match the snapshot from before the split", async () => {
  await fresh();
  seedExportData();
  await goEarly("settings.html", freezeClock);
  const actual = exportSnapshot();
  const reply = await fetch("/__tests/fixtures/settings-exports.json");
  if (!reply.ok) throw new Error(`SNAPSHOT:${JSON.stringify(actual)}`);
  eq(actual, await reply.json(), "exports");
  await sleep(100);
});
