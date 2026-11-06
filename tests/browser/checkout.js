"use strict";
// Checkout money. Rule: the cart, the confirmation screen and the recorded sale always
// agree, and a line is priced from its quantity unless it was sold by amount.
const coke = "addProductToCart(window.miniMartDB.products().find(p=>p.name==='Coke 1.5L'));";
const seedSuki = (stamps = 30, balance = stamps) => L("miniMartSukis", [{ id: "c1", name: "Ana", phone: "", joined: "2026-01-01", nfcId: "", stamps, rewardBalance: balance, active: true, history: [{ stampsEarned: stamps, date: new Date().toISOString() }] }]);
const seedRice = () => L("miniMartProducts", [{ id: "r", name: "Rice", category: "Snacks", price: 50, costPrice: 40, stock: 20, unit: "kg" }]);
const confirmation = () => ({ reward: text("confirmReward"), due: text("confirmDue"), change: text("confirmChange") });
const recorded = () => {
  const sale = J("miniMartSales")[0];
  return { reward: sale.rewardUsed, due: sale.cashRequired, change: sale.change };
};
const confirmSale = async () => {
  $("confirmCheckoutSale").click();
  await sleep(40);
};

test("a restored cart stays correct after adding, removing and selling", async () => {
  await fresh();
  await go("index.html");
  e(`${coke}${coke}saveCheckoutDraft()`);
  await go("index.html");
  eq(e("getCartTotal()"), 130, "total after reload");
  e(coke);
  e("document.querySelector('[data-increment]').click()");
  eq(e("[[...cart.values()][0].quantity,getCartTotal()]"), [4, 260], "after 2 more");
  e("document.querySelector('[data-decrement]').click()");
  eq(e("[[...cart.values()][0].quantity,getCartTotal()]"), [3, 195], "after 1 less");
  eq(text("totalAmount"), "₱195.00", "shown total");
  e("amountGiven.value='195';updatePayment();");
  $("sellButton").click();
  eq(text("confirmDue"), "₱195.00", "confirmation");
  await confirmSale();
  const sale = J("miniMartSales")[0];
  eq([sale.total, sale.items[0].lineTotal, sale.items[0].quantity], [195, 195, 3], "recorded sale");
});

test("a held cart with a stale line total is priced from its quantity", async () => {
  await fresh();
  L("miniMartHeldCarts", [{ id: "H", createdAt: new Date().toISOString(), items: [{ name: "Coke 1.5L", price: 65, quantity: 5, unit: "piece", amountMode: false, inputValue: "", lineTotal: 130 }] }]);
  await go("index.html");
  e("resumeHeldCart()");
  eq(e("getCartTotal()"), 325, "total");
});

test("a measured item sold by amount keeps the exact amount", async () => {
  await fresh();
  seedRice();
  await go("index.html");
  e("openMeasureModal(window.miniMartDB.products()[0]);setMeasureMode('amount');measureValue.value='33.33';updateMeasuredPreview();addMeasuredLine();");
  eq(e("[...cart.values()][0].quantity"), 0.666, "quantity");
  eq(e("getCartTotal()"), 33.33, "total");
});

test("a measured item sold by quantity is priced from its quantity", async () => {
  await fresh();
  seedRice();
  await go("index.html");
  e("openMeasureModal(window.miniMartDB.products()[0]);measureValue.value='0.25';updateMeasuredPreview();addMeasuredLine();");
  eq(e("getCartTotal()"), 12.5, "total");
});

test("a reward above the bill is clamped the same on screen and in the sale", async () => {
  await fresh();
  seedSuki(30);
  await go("index.html");
  e(`selectedSukiId='c1';${coke}updateSukiCheckoutInfo();document.getElementById('rewardAmount').value='65';amountGiven.value='35';updatePayment();`);
  $("sellButton").click();
  eq({ ...confirmation(), cash: text("confirmCash") }, { reward: "₱30.00", due: "₱35.00", change: "₱0.00", cash: "₱35.00" }, "confirmation");
  await confirmSale();
  eq(recorded(), { reward: 30, due: 35, change: 0 }, "recorded sale");
});

test("what can be spent comes from the points, whatever the old balance says", async () => {
  await fresh();
  seedSuki(30, 5);
  await go("index.html");
  e(`selectedSukiId='c1';${coke}updateSukiCheckoutInfo();document.getElementById('rewardAmount').value='20';amountGiven.value='60';updatePayment();`);
  $("sellButton").click();
  eq(confirmation(), { reward: "₱20.00", due: "₱45.00", change: "₱15.00" }, "confirmation");
  await confirmSale();
  eq(recorded(), { reward: 20, due: 45, change: 15 }, "recorded sale");
});

test("no more than the points are worth can be spent", async () => {
  await fresh();
  seedSuki(12, 50);
  await go("index.html");
  e(`selectedSukiId='c1';${coke}updateSukiCheckoutInfo();document.getElementById('rewardAmount').value='40';amountGiven.value='53';updatePayment();`);
  $("sellButton").click();
  eq(confirmation(), { reward: "₱12.00", due: "₱53.00", change: "₱0.00" }, "confirmation");
});

test("with no customer, a reward value in the box is ignored", async () => {
  await fresh();
  await go("index.html");
  e(`${coke}amountGiven.value='100';updatePayment();`);
  $("sellButton").click();
  eq(confirmation(), { reward: "₱0.00", due: "₱65.00", change: "₱35.00" }, "confirmation");
});

test("below the redeem minimum, no reward applies", async () => {
  await fresh();
  seedSuki(5);
  await go("index.html");
  e(`selectedSukiId='c1';${coke}updateSukiCheckoutInfo();amountGiven.value='65';updatePayment();`);
  $("sellButton").click();
  eq(text("confirmReward"), "₱0.00", "reward");
  eq(text("confirmDue"), "₱65.00", "due");
});

test("split payment shows the right cash and change", async () => {
  await fresh();
  await go("index.html");
  e(`${coke}paymentMethod.value='split';updatePaymentMethodUI();amountGiven.value='30';cardGiven.value='40';updatePayment();`);
  $("sellButton").click();
  eq({ cash: text("confirmCash"), change: text("confirmChange"), due: text("confirmDue") }, { cash: "₱70.00", change: "₱5.00", due: "₱65.00" }, "confirmation");
});
