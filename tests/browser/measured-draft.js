"use strict";
// Measured items sold by amount across a draft restore.
const product = (overrides = {}) => [{ id: "r", name: "Rice", category: "Snacks", price: 50, costPrice: 40, stock: 20, unit: "kg", ...overrides }];
const seed = async (products = product()) => {
  await fresh();
  L("miniMartProducts", products);
  L("miniMartDeletedProducts", ["Coke 1.5L"]);
};
const line = (mode, value) => `openMeasureModal(window.miniMartDB.products().find(p=>p.name==='Rice'));setMeasureMode('${mode}');measureValue.value='${value}';updateMeasuredPreview();addMeasuredLine();`;
const cartNow = () => JSON.parse(e("JSON.stringify([...cart.values()].map(i=>({q:i.quantity,t:i.lineTotal})))"));
const save = () => e("saveCheckoutDraft()");
const oldDraft = (quantity) => ({ version: 1, updatedAt: new Date().toISOString(), items: [{ name: "Rice", priceAtSave: 50, quantity, unit: "kg", amountMode: true, inputValue: "30" }], selectedSukiId: "", rewardAmount: "0", paymentMethod: "cash", amountGiven: "", cardGiven: "0" });

test("two amounts survive a reload", async () => {
  await seed();
  await go("index.html");
  e(line("amount", 20) + line("amount", 30));
  save();
  await go("index.html");
  eq(cartNow(), [{ q: 1, t: 50 }], "cart");
});

test("uneven amounts keep their exact values", async () => {
  await seed();
  await go("index.html");
  e(line("amount", "33.33") + line("amount", "33.33"));
  const before = cartNow();
  save();
  await go("index.html");
  eq(cartNow(), before, "cart");
});

test("a single uneven amount keeps its exact value", async () => {
  await seed();
  await go("index.html");
  e(line("amount", "33.33"));
  const before = cartNow();
  save();
  await go("index.html");
  eq(cartNow(), before, "cart");
});

test("quantity then amount survive a reload", async () => {
  await seed();
  await go("index.html");
  e(line("quantity", "0.25") + line("amount", "30"));
  save();
  await go("index.html");
  eq(cartNow(), [{ q: 0.85, t: 42.5 }], "cart");
});

test("amount then quantity survive a reload", async () => {
  await seed();
  await go("index.html");
  e(line("amount", "30") + line("quantity", "0.25"));
  save();
  await go("index.html");
  eq(cartNow(), [{ q: 0.85, t: 42.5 }], "cart");
});

test("a second reload changes nothing", async () => {
  await seed();
  await go("index.html");
  e(line("amount", 20) + line("amount", 30));
  save();
  await go("index.html");
  save();
  await go("index.html");
  eq(cartNow(), [{ q: 1, t: 50 }], "cart");
});

test("editing a combined line shows the full amount", async () => {
  await seed();
  await go("index.html");
  e(line("amount", 20) + line("amount", 30));
  e("openMeasureModal(window.miniMartDB.products()[0],'Rice')");
  const value = e("measureValue.value");
  e("closeMeasureModal()");
  eq(Number(value), 50, "edit box");
});

test("after a price change, the customer keeps the amount they asked for", async () => {
  await seed();
  await go("index.html");
  e(line("amount", 20) + line("amount", 30));
  save();
  await go("about:blank", 20);
  L("miniMartProducts", product({ price: 100 }));
  await go("index.html");
  eq(cartNow(), [{ q: 0.5, t: 50 }], "cart");
});

test("after a stock drop, the line is clamped to what is left", async () => {
  await seed();
  await go("index.html");
  e(line("amount", 20) + line("amount", 30));
  save();
  await go("about:blank", 20);
  L("miniMartProducts", product({ stock: 0.5 }));
  await go("index.html");
  eq(cartNow(), [{ q: 0.5, t: 25 }], "cart");
});

test("a sale after a restore records the full amount", async () => {
  await seed();
  await go("index.html");
  e(line("amount", 20) + line("amount", 30));
  save();
  await go("index.html");
  e("amountGiven.value='50';updatePayment();completeSale()");
  await sleep(40);
  const sale = J("miniMartSales")[0];
  eq([sale.total, sale.items[0].quantity, J("miniMartProducts")[0].stock], [50, 1, 19], "sale and stock");
});

test("an older draft with no saved total still loads", async () => {
  await seed();
  L("miniMartCheckoutDraft", oldDraft(0.6));
  await go("index.html");
  eq(cartNow(), [{ q: 0.6, t: 30 }], "cart");
});

test("an older draft with a mismatched quantity stays consistent", async () => {
  await seed();
  L("miniMartCheckoutDraft", oldDraft(1));
  await go("index.html");
  eq(cartNow(), [{ q: 0.6, t: 30 }], "cart");
});

test("uneven amount plus quantity keeps the exact value", async () => {
  await seed();
  await go("index.html");
  e(line("amount", "33.33") + line("quantity", "0.25"));
  const before = cartNow();
  save();
  await go("index.html");
  eq(cartNow(), before, "cart");
});

test("editing a combined line replaces it", async () => {
  await seed();
  await go("index.html");
  e(line("amount", 20) + line("amount", 30));
  e("openMeasureModal(window.miniMartDB.products()[0],'Rice');measureValue.value='10';updateMeasuredPreview();addMeasuredLine();");
  save();
  await go("index.html");
  eq(cartNow(), [{ q: 0.2, t: 10 }], "cart");
});

test("quantity lines behave as before", async () => {
  await seed();
  await go("index.html");
  e(line("quantity", "0.25") + line("quantity", "0.5"));
  save();
  await go("index.html");
  eq(cartNow(), [{ q: 0.75, t: 37.5 }], "cart");
});

test("fixed-price lines behave as before", async () => {
  await seed(product({ unit: "piece", stock: 9 }));
  await go("index.html");
  e("addProductToCart(window.miniMartDB.products()[0]);addProductToCart(window.miniMartDB.products()[0]);saveCheckoutDraft()");
  await go("index.html");
  e("addProductToCart(window.miniMartDB.products()[0])");
  eq(e("getCartTotal()"), 150, "total");
});
