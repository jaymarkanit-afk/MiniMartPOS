"use strict";
// Cart auto-save. Rule: a cart survives a reload, a bad draft never breaks checkout,
// restored prices and stock come from the current inventory, and a finished sale
// leaves no draft behind.
const KEY = "miniMartCheckoutDraft";
const coke = "addProductToCart(window.miniMartDB.products().find(p=>p.name==='Coke 1.5L'));";
const cartNames = () => e("[...cart.values()].map(i=>[i.name,i.quantity,lineAmount(i)])");
const setCoke = (changes) => {
  const products = J("miniMartProducts").map((product) => (product.name === "Coke 1.5L" ? { ...product, ...changes } : product));
  L("miniMartProducts", products);
};
const draft = (items, updatedAt = new Date().toISOString()) => ({ version: 1, updatedAt, items, selectedSukiId: "", rewardAmount: "0", paymentMethod: "cash", amountGiven: "", cardGiven: "0" });
const cokeLine = (overrides = {}) => ({ name: "Coke 1.5L", priceAtSave: 65, quantity: 2, lineTotal: 130, unit: "piece", amountMode: false, inputValue: "", ...overrides });
const seedAna = () => L("miniMartSukis", [{ id: "s1", name: "Ana", phone: "", joined: "2026-01-01", nfcId: "", stamps: 12, rewardBalance: 12, active: true, history: [] }]);

test("the cart saves itself without any explicit save", async () => {
  await fresh();
  await go("index.html");
  e(coke);
  await sleep(450);
  const saved = J(KEY);
  eq(saved.items.map((item) => [item.name, item.quantity]), [["Coke 1.5L", 1]], "saved items");
  eq(text("checkoutDraftStatus"), "Draft saved", "status");
});

test("a reload restores the cart, customer, payment method and amounts", async () => {
  await fresh();
  seedAna();
  await go("index.html");
  e(`${coke}${coke}selectedSukiId='s1';updateSukiCheckoutInfo();paymentMethod.value='gcash';updatePaymentMethodUI();amountGiven.value='130';updatePayment();saveCheckoutDraft()`);
  await go("index.html");
  eq(cartNames(), [["Coke 1.5L", 2, 130]], "cart");
  eq(e("selectedSukiId"), "s1", "customer");
  eq(e("paymentMethod.value"), "gcash", "payment method");
  eq(e("amountGiven.value"), "130", "amount given");
  eq(e("getCartTotal()"), 130, "total");
});

for (const [name, value] of [["broken JSON", "{bad"], ["the wrong shape", '{"version":1,"items":"x"}'], ["an unknown version", '{"version":99,"updatedAt":"2026-01-01T00:00:00.000Z","items":[]}']]) {
  test(`a draft with ${name} leaves an empty cart and working checkout`, async () => {
    await fresh();
    L(KEY, value);
    await go("index.html");
    eq(cartNames(), [], "cart");
    eq(Object.keys(localStorage).filter((key) => key.startsWith(`${KEY}__corrupt_`)).length, 1, "backups");
    ok(banner(), "No banner");
    e(`${coke}amountGiven.value='65';updatePayment();`);
    $("sellButton").click();
    $("confirmCheckoutSale").click();
    await sleep(40);
    eq(J("miniMartSales").length, 1, "sale after a bad draft");
  });
}

test("a draft older than 24 hours is discarded", async () => {
  await fresh();
  L(KEY, draft([cokeLine()], new Date(Date.now() - 25 * 3600000).toISOString()));
  await go("index.html");
  eq(cartNames(), [], "cart");
  eq(localStorage.getItem(KEY), null, "stored draft");
});

test("a draft just under 24 hours old is restored", async () => {
  await fresh();
  L(KEY, draft([cokeLine()], new Date(Date.now() - 23 * 3600000).toISOString()));
  await go("index.html");
  eq(cartNames(), [["Coke 1.5L", 2, 130]], "cart");
});

test("a changed price uses today's price and tells the cashier", async () => {
  await fresh();
  await go("index.html");
  e(`${coke}${coke}saveCheckoutDraft()`);
  await go("about:blank", 20);
  setCoke({ price: 70 });
  await go("index.html");
  eq(cartNames(), [["Coke 1.5L", 2, 140]], "cart");
  eq(e("getCartTotal()"), 140, "total");
  has(checkoutToast(), "adjusted because stock or prices changed", "toast");
});

test("lower stock clamps the quantity and tells the cashier", async () => {
  await fresh();
  await go("index.html");
  e(`${coke}${coke}${coke}saveCheckoutDraft()`);
  await go("about:blank", 20);
  setCoke({ stock: 1 });
  await go("index.html");
  eq(cartNames(), [["Coke 1.5L", 1, 65]], "cart");
  ok(/^1 item/.test(checkoutToast() || ""), `toast: ${checkoutToast()}`);
});

test("a sold-out item is removed and counted once", async () => {
  await fresh();
  await go("index.html");
  e(`${coke}saveCheckoutDraft()`);
  await go("about:blank", 20);
  setCoke({ stock: 0 });
  await go("index.html");
  eq(cartNames(), [], "cart");
  ok(/^1 item/.test(checkoutToast() || ""), `toast: ${checkoutToast()}`);
});

test("a deleted product is removed from the restored cart", async () => {
  await fresh();
  await go("index.html");
  e(`${coke}addProductToCart(window.miniMartDB.products().find(p=>p.name==='Sprite 1.5L'));saveCheckoutDraft()`);
  await go("about:blank", 20);
  L("miniMartDeletedProducts", ["Coke 1.5L"]);
  L("miniMartProducts", J("miniMartProducts").filter((product) => product.name !== "Coke 1.5L"));
  await go("index.html");
  eq(cartNames().map(([name]) => name), ["Sprite 1.5L"], "cart");
  has(checkoutToast(), "adjusted because stock or prices changed", "toast");
});

test("a finished sale clears the draft and it stays cleared", async () => {
  await fresh();
  await go("index.html");
  e(`${coke}saveCheckoutDraft();amountGiven.value='65';updatePayment();`);
  ok(localStorage.getItem(KEY), "Draft was not saved before the sale");
  $("sellButton").click();
  $("confirmCheckoutSale").click();
  await sleep(40);
  eq(J("miniMartSales").length, 1, "sales");
  eq(localStorage.getItem(KEY), null, "draft after sale");
  await sleep(450);
  eq(localStorage.getItem(KEY), null, "draft after the save delay");
  await go("index.html");
  eq(cartNames(), [], "cart after reload");
});

test("holding a cart clears the draft", async () => {
  await fresh();
  await go("index.html");
  e(`${coke}saveCheckoutDraft();holdCurrentCart();`);
  eq(localStorage.getItem(KEY), null, "draft");
  eq(J("miniMartHeldCarts").length, 1, "held carts");
  await go("index.html");
  eq(cartNames(), [], "cart after reload");
});

test("if the draft cannot be saved, the cashier is told and the cart stays", async () => {
  await fresh();
  await go("index.html");
  const undo = failWrites((key) => key === KEY);
  e(`${coke}saveCheckoutDraft()`);
  undo();
  eq(text("checkoutDraftStatus"), "Could not save draft", "status");
  eq(cartNames(), [["Coke 1.5L", 1, 65]], "cart");
});
