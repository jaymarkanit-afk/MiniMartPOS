"use strict";
// Permanent product ids. Rule: an id never changes and is never reused, every reference
// follows the product through a rename, and old sales keep the name they were sold under.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BACKUP_PREFIX = "miniMartProductIds__backup_";
const SEEDS = ["Coke 1.5L", "Sprite 1.5L", "Nature's Spring 500ml", "Nestea Lemon 1L", "Lucky Me Pancit Canton", "Lucky Me Chicken Noodles", "Payless Xtra Big", "Nissin Cup Noodles", "Piattos 40g", "Chippy Barbecue 110g", "Choc Nut 24g", "Nova Country 78g", "Bear Brand 33g", "Alaska Fortified Milk 1L", "Selecta Ice Cream Cup", "Yakult 5-Pack", "Skyflakes Crackers"];
const product = (name, stock, overrides = {}) => ({
  name, category: "Snacks", price: 10, costPrice: 5, stock, unit: "piece", icon: "x", accent: "var(--gold)", ...overrides,
});
const seedOld = () => {
  L("miniMartProducts", [
    product("Alpha", 40, { id: "product-alpha", barcode: "111" }),
    product("Beta", 20, { id: "product-beta" }),
    product("Gamma", 5),
  ]);
  L("miniMartDeletedProducts", SEEDS);
  L("miniMartCategories", ["Snacks"]);
  L("miniMartSales", [{
    id: "s1",
    date: new Date().toISOString(),
    items: [
      { name: "Alpha", price: 10, quantity: 2, productId: "product-alpha", category: "Snacks" },
      { name: "Gone Forever", price: 7, quantity: 1, productId: "Gone Forever", category: "Snacks" },
    ],
    total: 27,
    status: "completed",
  }]);
  L("miniMartHeldCarts", [{ id: "H1", createdAt: new Date().toISOString(), items: [{ name: "Beta", price: 10, quantity: 3, unit: "piece" }] }]);
  L("miniMartFavoriteProducts", ["Alpha", "Removed Product"]);
  L("miniMartRecentProducts", ["Beta"]);
  L("miniMartInventoryAdjustments", [{ product: "Alpha", adjustment: 1, previousStock: 39, stockAfter: 40, reason: "Delivery", date: new Date().toISOString() }]);
  L("miniMartCheckoutDraft", { version: 1, updatedAt: new Date().toISOString(), items: [{ name: "Beta", priceAtSave: 10, quantity: 1, unit: "piece", amountMode: false, inputValue: "" }], selectedSukiId: "", rewardAmount: "0", paymentMethod: "cash", amountGiven: "", cardGiven: "0" });
};
const P = (name) => J("miniMartProducts").find((entry) => entry.name === name);
const keys = (prefix) => Object.keys(localStorage).filter((key) => key.startsWith(prefix));
const rename = async (from, to) => {
  F.contentWindow.confirm = () => true;
  e(`openModal(window.miniMartDB.products().find(p=>p.name===${JSON.stringify(from)}));productName.value=${JSON.stringify(to)};form.requestSubmit()`);
  await sleep(40);
};

test("every product gets a uuid, and an id that is already good stays", async () => {
  await fresh();
  seedOld();
  L("miniMartProducts", [...J("miniMartProducts"), product("Kept", 1, { id: "my-own-id" })]);
  await go("index.html");
  ["Alpha", "Beta", "Gamma"].forEach((name) => ok(UUID.test(P(name).id), `${name} has id ${P(name).id}`));
  eq(P("Kept").id, "my-own-id", "good id");
});

test("migration leaves stock, totals, favourites and held carts the same", async () => {
  await fresh();
  seedOld();
  await go("index.html");
  eq(["Alpha", "Beta", "Gamma"].map((name) => P(name).stock), [40, 20, 5], "stock");
  eq(J("miniMartSales")[0].total, 27, "sale total");
  eq(J("miniMartSales")[0].items.map((item) => [item.name, item.quantity]), [["Alpha", 2], ["Gone Forever", 1]], "sale items");
  eq(J("miniMartFavoriteProducts"), [P("Alpha").id, "Removed Product"], "favourites");
  eq(J("miniMartRecentProducts"), [P("Beta").id], "recent");
  const held = J("miniMartHeldCarts")[0].items[0];
  eq([held.name, held.quantity, held.productId], ["Beta", 3, P("Beta").id], "held cart");
});

test("references get the new id, and unmatched sale items are left alone", async () => {
  await fresh();
  seedOld();
  await go("index.html");
  const [alpha, gone] = J("miniMartSales")[0].items;
  eq(alpha.productId, P("Alpha").id, "matched sale item");
  eq(gone.productId, "Gone Forever", "unmatched sale item");
  eq(J("miniMartInventoryAdjustments")[0].productId, P("Alpha").id, "history");
  eq(J("miniMartInventoryAdjustments")[0].product, "Alpha", "history name");
  eq(J("miniMartCheckoutDraft").items[0].productId, P("Beta").id, "draft");
});

test("the raw originals are backed up first, and only once", async () => {
  await fresh();
  seedOld();
  const original = localStorage.miniMartProducts;
  const heldOriginal = localStorage.miniMartHeldCarts;
  await go("index.html");
  eq(keys(BACKUP_PREFIX).length, 1, "backups");
  const backup = JSON.parse(localStorage[keys(BACKUP_PREFIX)[0]]);
  eq(backup.miniMartProducts, original, "products in the backup");
  eq(backup.miniMartHeldCarts, heldOriginal, "held carts in the backup");
  await go("index.html");
  eq(keys(BACKUP_PREFIX).length, 1, "backups after a reload");
});

test("if the backup fails, nothing migrates", async () => {
  await fresh();
  seedOld();
  const original = localStorage.miniMartProducts;
  const fail = (w) => {
    const setItem = w.Storage.prototype.setItem;
    w.Storage.prototype.setItem = function setItemFailing(key, value) {
      if (key.startsWith("miniMartProductIds__backup_")) throw new w.DOMException("full", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
  };
  await goEarly("inventory.html", fail);
  eq(JSON.parse(original).map((entry) => entry.id), [ "product-alpha", "product-beta", null], "input");
  eq(J("miniMartProducts").map((entry) => entry.id).slice(0, 2), ["product-alpha", "product-beta"], "ids");
  ok(Number(localStorage.miniMartDataVersion || 0) < 3, "Marked as migrated");
});

test("if a migration write fails, every key goes back", async () => {
  await fresh();
  seedOld();
  const names = ["miniMartSales", "miniMartHeldCarts", "miniMartFavoriteProducts", "miniMartRecentProducts"];
  const before = names.map((name) => localStorage[name]);
  await goEarly("settings.html", (w) => {
    const setItem = w.Storage.prototype.setItem;
    w.Storage.prototype.setItem = function setItemFailing(key, value) {
      if (key === "miniMartFavoriteProducts" && !String(value).startsWith("[\"Alpha")) throw new w.DOMException("full", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
  });
  eq(names.map((name) => localStorage[name]), before, "storage");
  // Gamma has no id at all, so ordinary reading may still give it one.
  eq(J("miniMartProducts").map((entry) => entry.id).slice(0, 2), ["product-alpha", "product-beta"], "old ids kept");
  ok(Number(localStorage.miniMartDataVersion || 0) < 3, "Marked as migrated");
});

test("reloading twice does not run the migration again or change ids", async () => {
  await fresh();
  seedOld();
  await go("index.html");
  const ids = J("miniMartProducts").map((entry) => entry.id);
  const sales = localStorage.miniMartSales;
  await go("index.html");
  await go("inventory.html");
  eq(J("miniMartProducts").map((entry) => entry.id), ids, "ids");
  eq(localStorage.miniMartSales, sales, "sales");
});

test("a first visit gives sample products uuids that stay the same", async () => {
  await fresh();
  await go("index.html");
  const ids = J("miniMartProducts").map((entry) => entry.id);
  ok(ids.every((id) => UUID.test(id)), `ids: ${ids.slice(0, 2)}`);
  eq(new Set(ids).size, 17, "distinct ids");
  await go("index.html");
  eq(J("miniMartProducts").map((entry) => entry.id), ids, "ids after a reload");
});

test("a new product gets a uuid", async () => {
  await fresh();
  seedOld();
  await go("inventory.html");
  e("openProductModal('Snacks');productName.value='Delta';productCost.value='5';productPrice.value='7';productStock.value='11';form.requestSubmit()");
  await sleep(40);
  ok(UUID.test(P("Delta").id), `id: ${P("Delta").id}`);
});

test("an id is never reused after a delete", async () => {
  await fresh();
  seedOld();
  await go("inventory.html");
  const old = P("Gamma").id;
  e(`pendingDeleteId=${JSON.stringify(old)};document.getElementById('confirmDeleteProduct').click()`);
  await sleep(40);
  e("openProductModal('Snacks');productName.value='Gamma';productCost.value='5';productPrice.value='7';productStock.value='1';form.requestSubmit()");
  await sleep(40);
  ok(P("Gamma").id !== old, "The id was reused");
});

test("a sale records the product id, and a void after a rename returns stock to it", async () => {
  await fresh();
  seedOld();
  L("miniMartCheckoutDraft", "null");
  localStorage.removeItem("miniMartCheckoutDraft");
  await go("index.html");
  e("addProductToCart(window.miniMartDB.products().find(p=>p.name==='Alpha'));amountGiven.value='10';updatePayment();");
  $("sellButton").click();
  $("confirmCheckoutSale").click();
  await sleep(40);
  const sale = J("miniMartSales").at(-1);
  const id = P("Alpha").id;
  eq(sale.items[0].productId, id, "sale item");
  eq(P("Alpha").stock, 39, "stock after the sale");
  await go("inventory.html");
  await rename("Alpha", "Alpha Renamed");
  await go("reports.html?period=all");
  F.contentWindow.prompt = () => "APPROVE";
  e(`voidSale(${JSON.stringify(sale.id)})`);
  await sleep(350);
  eq([P("Alpha Renamed").id, P("Alpha Renamed").stock], [id, 40], "stock after the void");
});

test("after a rename, history, favourite, held cart and reports follow the product", async () => {
  await fresh();
  seedOld();
  await go("inventory.html");
  const betaId = P("Beta").id;
  const alphaId = P("Alpha").id;
  await rename("Alpha", "Alpha Renamed");
  await rename("Beta", "Beta Renamed");
  eq([P("Alpha Renamed").id, P("Beta Renamed").id], [alphaId, betaId], "ids");
  e(`openStockHistory(${JSON.stringify(alphaId)})`);
  eq(F.contentDocument.querySelectorAll(".stock-history-row").length, 1, "history rows");
  localStorage.removeItem("miniMartCheckoutDraft");
  await go("index.html");
  ok(F.contentDocument.querySelector(`[data-favorite="${alphaId}"]`)?.classList.contains("is-favorite"), "Favourite did not follow");
  e("resumeHeldCart()");
  eq(e("[...cart.values()].map(i=>[i.name,i.productId,i.quantity])"), [["Beta Renamed", betaId, 3]], "held cart");
  await go("reports.html?period=all");
  has(text("topProducts"), "Alpha Renamed", "top products");
  ok(!text("topProducts").includes("Alpha x"), "Old name in top products");
  has($("salesList")?.textContent ?? F.contentDocument.body.textContent, "Alpha x2", "the old sale keeps its name");
});

test("a report filtered to a renamed product still finds its old sales", async () => {
  await fresh();
  seedOld();
  await go("inventory.html");
  const id = P("Alpha").id;
  await rename("Alpha", "Alpha Renamed");
  await go(`reports.html?period=all&product=${id}`);
  eq(e("sales.length"), 1, "sales found");
});

test("an unmatched sale item is still grouped by its name in reports", async () => {
  await fresh();
  seedOld();
  await go("reports.html?period=all");
  has(text("topProducts"), "Gone Forever", "top products");
});

test("a draft follows a rename", async () => {
  await fresh();
  seedOld();
  await go("inventory.html");
  await rename("Beta", "Beta Renamed");
  await go("index.html");
  eq(e("[...cart.values()].map(i=>i.name)"), ["Beta Renamed"], "cart");
});

test("two products with the same name stay separate", async () => {
  await fresh();
  L("miniMartProducts", [product("Twin", 5, { id: "product-twin", price: 10 }), product("Twin", 7, { id: "product-twin", price: 20 })]);
  L("miniMartDeletedProducts", SEEDS);
  await go("index.html");
  const stored = J("miniMartProducts");
  ok(stored[0].id !== stored[1].id, "Same id");
  e(`addProductToCart(window.miniMartDB.products()[0]);addProductToCart(window.miniMartDB.products()[1]);amountGiven.value='30';updatePayment();`);
  eq(e("cart.size"), 2, "cart lines");
  $("sellButton").click();
  $("confirmCheckoutSale").click();
  await sleep(40);
  eq(J("miniMartProducts").map((entry) => entry.stock), [4, 6], "stock");
  await go("inventory.html");
  const [first, second] = J("miniMartProducts");
  e(`openStockHistory(${JSON.stringify(first.id)})`);
  eq(F.contentDocument.querySelectorAll(".stock-history-row").length, 1, "history for the first twin");
  eq(F.contentDocument.querySelectorAll(`tr[data-product-id="${second.id}"]`).length, 1, "row for the second twin");
});

test("bulk edit selects a product by id, so twins are not mixed up", async () => {
  await fresh();
  L("miniMartProducts", [product("Twin", 5, { id: "a" }), product("Twin", 7, { id: "b" })]);
  L("miniMartDeletedProducts", SEEDS);
  await go("inventory.html");
  F.contentDocument.querySelectorAll(".product-select")[1].click();
  $("editSelectedProducts").click();
  await sleep(40);
  [...$("bulkEditRows").querySelectorAll('[data-field="stock"]')].forEach((input) => { input.value = "50"; });
  $("bulkEditForm").requestSubmit();
  await sleep(50);
  eq(J("miniMartProducts").map((entry) => entry.stock), [5, 50], "stock");
});

const importRows = (rows) => `productImportRows=validateProductImportRows(${JSON.stringify(rows)});productDuplicateMode.value='update';importProducts()`;

test("an old import with no ids matches by name, warns, and adds no duplicates", async () => {
  await fresh();
  seedOld();
  await go("settings.html");
  const id = P("Alpha").id;
  const rows = e(`JSON.stringify(validateProductImportRows(${JSON.stringify([{ name: "alpha", category: "Snacks", cost: 5, price: 10, stock: 41 }])}))`);
  eq(JSON.parse(rows)[0].matchedBy, "name", "match");
  eq(JSON.parse(rows)[0].warning, true, "warning");
  e(importRows([{ name: "alpha", category: "Snacks", cost: 5, price: 10, stock: 41 }]));
  await sleep(30);
  eq(J("miniMartProducts").filter((entry) => entry.name.toLowerCase() === "alpha").length, 1, "products");
  eq(J("miniMartProducts").find((entry) => entry.id === id).stock, 41, "stock");
});

test("an import matches by barcode first, even when the name changed", async () => {
  await fresh();
  seedOld();
  await go("settings.html");
  const id = P("Alpha").id;
  e(importRows([{ barcode: "111", name: "New Alpha", category: "Snacks", cost: 5, price: 10, stock: 8 }]));
  await sleep(30);
  eq([J("miniMartProducts").find((entry) => entry.id === id).name, J("miniMartProducts").find((entry) => entry.id === id).stock], ["New Alpha", 8], "product");
  eq(J("miniMartProducts").length, 3, "products");
});

test("an import matches by id before name", async () => {
  await fresh();
  seedOld();
  await go("settings.html");
  const id = P("Beta").id;
  e(importRows([{ id, name: "New Beta", category: "Snacks", cost: 5, price: 10, stock: 9 }]));
  await sleep(30);
  eq(J("miniMartProducts").find((entry) => entry.id === id).name, "New Beta", "name");
  eq(J("miniMartProducts").length, 3, "products");
});

test("an imported new product gets a uuid", async () => {
  await fresh();
  seedOld();
  await go("settings.html");
  e(importRows([{ name: "Newbie", category: "Snacks", cost: 5, price: 10, stock: 8 }]));
  await sleep(30);
  await go("settings.html");
  ok(UUID.test(P("Newbie").id), `id: ${P("Newbie").id}`);
});

test("restoring an old backup with no ids runs the migration", async () => {
  await fresh();
  await go("settings.html");
  const data = JSON.parse(e("JSON.stringify(readBackupData())"));
  data.products = [product("Old One", 3), product("Old Two", 4, { id: "product-old-two" })];
  data.favoriteProducts = ["Old One"];
  data.deletedProducts = [];
  data.sales = [{ id: "z", date: new Date().toISOString(), items: [{ name: "Old One", price: 10, quantity: 1 }], total: 10, status: "completed" }];
  e(`restoreBackupData(${JSON.stringify(data)})`);
  await go("index.html");
  await go("index.html");
  ok(J("miniMartProducts").every((entry) => UUID.test(entry.id)), "Not every product has a uuid");
  eq(J("miniMartFavoriteProducts"), [P("Old One").id], "favourites");
  eq(J("miniMartSales")[0].items[0].productId, P("Old One").id, "sale item");
});

test("a backup includes product ids", async () => {
  await fresh();
  seedOld();
  await go("settings.html");
  const id = P("Alpha").id;
  ok(e("readBackupData().products").some((entry) => entry.id === id), "No id in the backup");
});
