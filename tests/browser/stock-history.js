"use strict";
// Stock history. Rule: every stock change is logged with its reason, atomically with
// the change, and the newest 1,000 entries are kept with an export warning.
const H = () => J("miniMartInventoryAdjustments") || [];
const brief = (list) => list.map((entry) => [entry.product, entry.previousStock, entry.adjustment, entry.stockAfter, entry.reason, entry.source, entry.reference]);
const stock = (name) => J("miniMartProducts").find((product) => product.name === name).stock;
const PRODUCT = { category: "Snacks", costPrice: 10, price: 15, unit: "piece", icon: "x", accent: "var(--gold)" };
const P = [
  { ...PRODUCT, id: "p1", name: "Alpha", stock: 40 },
  { ...PRODUCT, id: "p2", name: "Beta", stock: 20 },
  { ...PRODUCT, id: "p3", name: "Gamma", stock: 5 },
  { ...PRODUCT, id: "p4", name: "Rice", category: "Grains", costPrice: 40, price: 50, stock: 10.5, unit: "kg" },
];
const SEEDS = ["Coke 1.5L", "Sprite 1.5L", "Nature's Spring 500ml", "Nestea Lemon 1L", "Lucky Me Pancit Canton", "Lucky Me Chicken Noodles", "Payless Xtra Big", "Nissin Cup Noodles", "Piattos 40g", "Chippy Barbecue 110g", "Choc Nut 24g", "Nova Country 78g", "Bear Brand 33g", "Alaska Fortified Milk 1L", "Selecta Ice Cream Cup", "Yakult 5-Pack", "Skyflakes Crackers"];
const OLD_ENTRY = { product: "Alpha", previousStock: 1, adjustment: 1, stockAfter: 2, reason: "Delivery", date: "2026-01-01T00:00:00.000Z" };
const FULL_MESSAGE = "Could not save. Browser storage is full. Export your data and clear old records.";
const seed = async () => {
  await fresh();
  L("miniMartProducts", P);
  L("miniMartCategories", ["Snacks", "Grains"]);
  L("miniMartDeletedProducts", SEEDS);
};
const saleUI = async (names, given) => {
  e(`${names.map((name) => `addProductToCart(window.miniMartDB.products().find(p=>p.name===${JSON.stringify(name)}));`).join("")}amountGiven.value='${given}';updatePayment();`);
  $("sellButton").click();
  $("confirmCheckoutSale").click();
  await sleep(40);
};
const form = async (name, setup) => {
  F.contentWindow.confirm = () => true;
  e(`openModal(window.miniMartDB.products().find(p=>p.name===${JSON.stringify(name)}));${setup}form.requestSubmit()`);
  await sleep(40);
};
const importRows = (rows) => `productImportRows=validateProductImportRows(${JSON.stringify(rows)});productDuplicateMode.value='update';`;
const stubExcel = (run) => {
  const original = F.contentWindow.XLSX.writeFile;
  let written = null;
  F.contentWindow.XLSX.writeFile = (workbook, name) => { written = [workbook, name]; };
  run();
  F.contentWindow.XLSX.writeFile = original;
  return written;
};

test("the product form logs a stock change", async () => {
  await seed();
  await go("inventory.html");
  await form("Alpha", "productStock.value='33';");
  eq(brief(H()), [["Alpha", 40, -7, 33, "edit-form", "", null]], "history");
});

test("editing only the price logs nothing", async () => {
  await seed();
  await go("inventory.html");
  await form("Alpha", "productPrice.value='16';");
  eq(H().length, 0, "entries");
  eq(J("miniMartProducts").find((product) => product.name === "Alpha").price, 16, "price saved");
});

test("renaming a product keeps its history together", async () => {
  await seed();
  await go("inventory.html");
  await form("Alpha", "productStock.value='30';");
  await form("Alpha", "productName.value='Alpha Two';productStock.value='29';");
  e("openStockHistory(window.miniMartDB.products().find(p=>p.name==='Alpha Two').id)");
  eq(F.contentDocument.querySelectorAll(".stock-history-row").length, 2, "rows shown");
  eq(brief(H()).at(-1), ["Alpha Two", 30, -1, 29, "edit-form", "", null], "last entry");
});

test("adding a product logs its opening stock", async () => {
  await seed();
  await go("inventory.html");
  e("openProductModal('Snacks');productName.value='Delta';productCost.value='5';productPrice.value='7';productStock.value='11';form.requestSubmit()");
  await sleep(40);
  eq(brief(H()), [["Delta", 0, 11, 11, "initial", "", null]], "history");
});

test("bulk edit logs each changed product", async () => {
  await seed();
  await go("inventory.html");
  F.contentDocument.querySelectorAll(".product-select").forEach((checkbox, index) => {
    if (index < 3) checkbox.click();
  });
  $("editSelectedProducts").click();
  await sleep(40);
  [...$("bulkEditRows").querySelectorAll('[data-field="stock"]')].forEach((input, index) => {
    input.value = String(100 + index);
  });
  $("bulkEditForm").requestSubmit();
  await sleep(50);
  eq(brief(H()), [["Alpha", 40, 60, 100, "bulk-edit", "", null], ["Beta", 20, 81, 101, "bulk-edit", "", null], ["Gamma", 5, 97, 102, "bulk-edit", "", null]], "history");
});

test("a manual adjustment and its undo are both logged", async () => {
  await seed();
  await go("inventory.html");
  e("openStockAdjustment([window.miniMartDB.products().find(p=>p.name==='Alpha').id]);stockAdjustmentQuantity.value='5';stockAdjustmentReason.selectedIndex=0;document.getElementById('saveStockAdjustment').click()");
  await sleep(30);
  e("undoStockAdjustment.click()");
  await sleep(30);
  eq(brief(H()), [["Alpha", 40, 5, 45, "manual-adjust", "Delivery", null], ["Alpha", 45, -5, 40, "manual-adjust", "Undo", null]], "history");
  eq(stock("Alpha"), 40, "stock");
});

test("deleting a product logs its stock going to zero", async () => {
  await seed();
  await go("inventory.html");
  e("pendingDeleteId=window.miniMartDB.products().find(p=>p.name==='Gamma').id;document.getElementById('confirmDeleteProduct').click()");
  await sleep(30);
  eq(brief(H()), [["Gamma", 5, -5, 0, "delete", "", null]], "history");
});

test("an import logs only the stock it changed, with the file name", async () => {
  await seed();
  await go("settings.html");
  e(`${importRows([{ name: "Alpha", category: "Snacks", cost: 10, price: 15, stock: 55 }, { name: "Beta", category: "Snacks", cost: 10, price: 15, stock: 20 }, { name: "Newbie", category: "Snacks", cost: 1, price: 2, stock: 9 }])}productImportFileData={file:{name:'stock.xlsx'}};importProducts()`);
  await sleep(30);
  eq(brief(H()), [["Alpha", 40, 15, 55, "import", "stock.xlsx", null], ["Newbie", 0, 9, 9, "import", "stock.xlsx", null]], "history");
});

test("a sale and its void are both logged against the sale id", async () => {
  await seed();
  await go("index.html");
  await saleUI(["Alpha", "Alpha", "Beta"], "100");
  const sale = J("miniMartSales")[0];
  eq(sale.total, 45, "total");
  eq(brief(H()), [["Alpha", 40, -2, 38, "sale", "", sale.id], ["Beta", 20, -1, 19, "sale", "", sale.id]], "sale entries");
  await go("reports.html?period=all");
  F.contentWindow.prompt = () => "APPROVE";
  e(`voidSale(${JSON.stringify(sale.id)})`);
  await sleep(350);
  eq(brief(H()).slice(2), [["Alpha", 38, 2, 40, "void", "", sale.id], ["Beta", 19, 1, 20, "void", "", sale.id]], "void entries");
  eq(J("miniMartSales")[0].status, "voided", "status");
  eq([stock("Alpha"), stock("Beta")], [40, 20], "stock");
});

test("a measured sale logs exact decimals", async () => {
  await seed();
  await go("index.html");
  e("openMeasureModal(window.miniMartDB.products().find(p=>p.name==='Rice'));measureValue.value='0.3';updateMeasuredPreview();addMeasuredLine();amountGiven.value='100';updatePayment();");
  $("sellButton").click();
  $("confirmCheckoutSale").click();
  await sleep(40);
  const sale = J("miniMartSales")[0];
  eq(brief(H()), [["Rice", 10.5, -0.3, 10.2, "sale", "", sale.id]], "history");
});

test("if history cannot be written, the stock change does not happen", async () => {
  await seed();
  await go("inventory.html");
  const before = [localStorage.miniMartProducts, localStorage.miniMartInventoryAdjustments];
  const undo = failWrites((key) => key === "miniMartInventoryAdjustments");
  await form("Alpha", "productStock.value='1';");
  undo();
  eq([localStorage.miniMartProducts, localStorage.miniMartInventoryAdjustments], before, "storage");
  ok(!$("categoryModal").hidden, "Form closed after a failed save");
  eq(storageToast(), FULL_MESSAGE, "toast");
});

test("if stock cannot be written, the history entry is rolled back", async () => {
  await seed();
  L("miniMartInventoryAdjustments", [OLD_ENTRY]);
  await go("inventory.html");
  const before = [localStorage.miniMartProducts, localStorage.miniMartInventoryAdjustments];
  const undo = failWrites((key) => key === "miniMartProducts");
  await form("Alpha", "productStock.value='1';");
  undo();
  eq(localStorage.miniMartInventoryAdjustments, before[1], "history");
  eq(localStorage.miniMartProducts, before[0], "stock");
  ok(storageToast(), "No error shown");
});

test("a sale that cannot save leaves stock and history alone", async () => {
  await seed();
  await go("index.html");
  const names = ["miniMartProducts", "miniMartInventoryAdjustments", "miniMartSales"];
  const before = names.map((key) => localStorage[key]);
  const undo = failWrites((key) => key === "miniMartSales");
  await saleUI(["Alpha"], "15");
  undo();
  eq(names.map((key) => localStorage[key]), before, "storage");
  eq(e("cart.size"), 1, "cart kept");
  eq(e("saleInProgress"), false, "sale lock");
});

test("a void that cannot save leaves stock and history alone", async () => {
  await seed();
  L("miniMartSales", [{ id: "v1", date: new Date().toISOString(), items: [{ name: "Alpha", price: 15, quantity: 2, category: "Snacks", productId: "p1" }], total: 30, status: "completed" }]);
  await go("reports.html?period=all");
  F.contentWindow.prompt = () => "APPROVE";
  const before = [localStorage.miniMartProducts, localStorage.miniMartSales];
  const undo = failWrites((key) => key === "miniMartSales");
  e("voidSale('v1')");
  await sleep(250);
  undo();
  eq([localStorage.miniMartProducts, localStorage.miniMartSales], before, "storage");
  eq(H().length, 0, "history entries");
  ok(storageToast(), "No error shown");
});

test("an import that fails part way changes nothing", async () => {
  await seed();
  await go("settings.html");
  const history = localStorage.miniMartInventoryAdjustments;
  const undo = failWrites((key) => key === "miniMartCategories");
  e(`${importRows([{ name: "Alpha", category: "Snacks", cost: 10, price: 15, stock: 55 }])}importProducts()`);
  undo();
  await sleep(30);
  eq(J("miniMartProducts")[0].stock, 40, "stock");
  eq(localStorage.miniMartInventoryAdjustments, history, "history");
});

test("the viewer shows old and new entries, newest first, with no injected HTML", async () => {
  await seed();
  L("miniMartInventoryAdjustments", [
    { product: "Alpha", previousStock: 40, adjustment: 5, stockAfter: 45, reason: "Delivery", date: "2026-01-01T00:00:00.000Z" },
    { product: "Alpha", previousStock: 45, adjustment: -5, stockAfter: 40, reason: "<b>Damaged</b>", date: "2026-01-02T00:00:00.000Z" },
  ]);
  await go("inventory.html");
  await form("Alpha", "productStock.value='41';");
  e("openStockAdjustment([window.miniMartDB.products().find(p=>p.name==='Alpha').id]);stockAdjustmentQuantity.value='1';stockAdjustmentReason.selectedIndex=0;document.getElementById('saveStockAdjustment').click()");
  await sleep(30);
  e("openStockHistory(window.miniMartDB.products().find(p=>p.name==='Alpha').id)");
  const rows = [...F.contentDocument.querySelectorAll(".stock-history-row")].map((row) => row.textContent.split(" · ").slice(0, -1).join(" · "));
  eq(rows, ["+1 Manual adjustment · Delivery41 → 42", "+1 Product edit40 → 41", "-5 <b>Damaged</b>45 → 40", "+5 Delivery40 → 45"], "rows");
  eq(F.contentDocument.querySelectorAll(".stock-history-row b").length, 0, "injected elements");
});

test("the history export has the right columns and values", async () => {
  await seed();
  L("miniMartInventoryAdjustments", [
    { product: "Alpha", previousStock: 40, adjustment: 5, stockAfter: 45, reason: "Delivery", date: "2026-01-01T00:00:00.000Z" },
    { product: "Beta", previousStock: 1, adjustment: 1, stockAfter: 2, reason: "sale", source: "", reference: "TX-1", date: "2026-01-02T00:00:00.000Z" },
  ]);
  await go("settings.html");
  const [workbook, name] = stubExcel(() => e("exportInventoryHistoryFile()"));
  ok(/^MiniMart_Inventory_History_\d{4}-\d{2}-\d{2}\.xlsx$/.test(name), `filename: ${name}`);
  const rows = e("(w=>XLSX.utils.sheet_to_json(w,{header:1}))")(workbook.Sheets["Inventory History"]);
  eq(rows, [
    ["Date", "Product", "Previous stock", "Adjustment", "Stock after", "Reason", "Source", "Reference"],
    ["2026-01-01T00:00:00.000Z", "Alpha", 40, 5, 45, "Delivery", "", ""],
    ["2026-01-02T00:00:00.000Z", "Beta", 1, 1, 2, "sale", "", "TX-1"],
  ], "rows");
});

test("history stops at 1,000 entries and warns until it is exported", async () => {
  await seed();
  L("miniMartInventoryAdjustments", Array.from({ length: 999 }, (_, index) => ({ product: "Alpha", previousStock: 1, adjustment: 1, stockAfter: 2, reason: "Delivery", date: new Date(Date.now() - 1e8 + index).toISOString() })));
  await go("inventory.html");
  eq($("stockHistoryNotice").textContent.trim(), "999 stock history entries have not been exported. Only the newest 1000 are kept, so export it soon. Export it in Settings, under Data & Backup.", "early warning");
  await form("Alpha", "productStock.value='30';");
  await form("Alpha", "productStock.value='31';");
  await form("Alpha", "productStock.value='32';");
  eq(H().length, 1000, "entries");
  eq(H().at(-1).stockAfter, 32, "newest kept");
  eq(J("miniMartStockHistoryExport"), { exportedAt: "", droppedUnexported: 2 }, "export state");
  await go("settings.html");
  eq($("stockHistoryNotice").textContent, "2 older stock history entries were removed before being exported. Only the newest 1000 are kept, so export it now.", "loss warning");
  ok(!$("stockHistoryNotice").hidden, "Warning hidden");
  stubExcel(() => e("exportInventoryHistoryFile()"));
  ok($("stockHistoryNotice").hidden, "Warning still shown after export");
  await go("inventory.html");
  await form("Alpha", "productStock.value='33';");
  eq(J("miniMartStockHistoryExport").droppedUnexported, 0, "dropped after export");
  ok($("stockHistoryNotice").hidden, "Warning shown after an exported trim");
});

test("a restore logs what it changed", async () => {
  await seed();
  await go("settings.html");
  const file = JSON.parse(e("JSON.stringify({format:BACKUP_FORMAT,version:2,data:readBackupData()})"));
  file.data.products[0].stock = 99;
  file.data.inventoryAdjustments = [OLD_ENTRY];
  e(`restoreBackupData(${JSON.stringify(file.data)})`);
  eq(brief(H()), [["Alpha", 1, 1, 2, "Delivery", null, null], ["Alpha", 40, 59, 99, "restore", "", null]], "history");
});

test("restoring a file with no history keeps the current history", async () => {
  await seed();
  L("miniMartInventoryAdjustments", [OLD_ENTRY]);
  await go("settings.html");
  e(`restoreBackupData(${JSON.stringify({ products: [{ ...P[0], stock: 7 }, P[1], P[2], P[3]], sales: [], categories: ["Snacks"], customers: [], settings: {} })})`);
  eq(brief(H()), [["Alpha", 1, 1, 2, "Delivery", null, null], ["Alpha", 40, -33, 7, "restore", "", null]], "history");
});

test("a first visit logs seed stock once", async () => {
  await fresh();
  await go("index.html");
  eq(H().length, 17, "entries");
  eq([H()[0].reason, H()[0].source], ["initial", "Seed data"], "first entry");
  await go("index.html");
  eq(H().length, 17, "entries after reload");
});

test("after Reset all data, seed products do not come back", async () => {
  // Reset says it erases every product. Open bug: products() adds the seeds back.
  await fresh();
  await go("settings.html");
  e("resetAllData()");
  await sleep(30);
  eq(H().length, 0, "history straight after reset");
  eq(e("window.miniMartDB.products().length"), 0, "products after reset");
  eq(H().length, 0, "history after reading products");
});

test("reading the app writes no products or history", async () => {
  await seed();
  await go("index.html", 500);
  const first = F.contentWindow.__c.set;
  ok(!first.includes("miniMartProducts"), `First load wrote products: ${first}`);
  ok(!first.includes("miniMartInventoryAdjustments"), `First load wrote history: ${first}`);
  await go("index.html", 500);
  eq(F.contentWindow.__c.set, [], "writes on a plain reload");
});

test("damaged history does not stop a sale, and is kept", async () => {
  await seed();
  localStorage.setItem("miniMartInventoryAdjustments", "{bad");
  await go("index.html");
  await saleUI(["Alpha"], "15");
  eq(J("miniMartSales")?.length, 1, "sales");
  eq(H().length, 1, "history entries");
  eq(Object.keys(localStorage).filter((key) => key.startsWith("miniMartInventoryAdjustments__corrupt_")).map((key) => localStorage[key]), ["{bad"], "backup");
  ok($("storageWarning"), "No banner");
});
