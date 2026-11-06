"use strict";
// KNOWN BUGS: open bugs from the first analysis, reported and not fixed yet. These run
// in Asia/Manila and never affect the exit code. When a fix lands, a test here shows
// NOW PASSES and should move into its main suite.
const manila = (time) => Date.parse(`${time}+08:00`);
const freezeClock = (now) => (w) => {
  const RealDate = w.Date;
  w.Date = class extends RealDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(now);
    }

    static now() {
      return now;
    }
  };
};
const coke = "addProductToCart(window.miniMartDB.products().find(p=>p.name==='Coke 1.5L'));";
const openShift = () => L("miniMartCurrentShift", { id: "S", openedAt: new Date().toISOString(), openingCash: 500, sales: 0, cashSales: 0 });
const sell = async (setup) => {
  e(`${coke}${setup}updatePayment();`);
  $("sellButton").click();
  $("confirmCheckoutSale").click();
  await sleep(40);
};
const saleOn = (id, time, total) => ({
  id,
  date: new Date(manila(time)).toISOString(),
  items: [{ name: "Coke 1.5L", price: total, quantity: 1, lineTotal: total, category: "Beverages" }],
  total,
  status: "completed",
});
const reportsAt = async (now, sales) => {
  await fresh();
  L("miniMartSettings", { timezone: "Asia/Manila" });
  L("miniMartSales", sales);
  await goEarly("reports.html", freezeClock(now));
};

test("shift cash: a P65 cash sale paid with P100 adds P65 to the shift", async () => {
  await fresh();
  openShift();
  await go("index.html");
  await sell("amountGiven.value='100';");
  eq(J("miniMartCurrentShift").cashSales, 65, "shift cash sales");
});

test("shift cash: the sale records P65 cash, not the P100 tendered", async () => {
  await fresh();
  openShift();
  await go("index.html");
  await sell("amountGiven.value='100';");
  eq(J("miniMartSales")[0].payments.cash, 65, "cash on the sale");
});

test("shift cash: a card sale adds nothing to shift cash", async () => {
  await fresh();
  openShift();
  await go("index.html");
  await sell("paymentMethod.value='card';updatePaymentMethodUI();amountGiven.value='65';");
  eq(J("miniMartCurrentShift").cashSales, 0, "shift cash sales");
});

test("close shift: Cancel leaves the shift open", async () => {
  await fresh();
  openShift();
  await go("index.html");
  F.contentWindow.prompt = () => null;
  e("manageShift()");
  eq(J("miniMartCurrentShift")?.id, "S", "open shift");
  eq(J("miniMartShiftHistory") || [], [], "closed shifts");
});

test("close shift: a blank amount leaves the shift open", async () => {
  await fresh();
  openShift();
  await go("index.html");
  F.contentWindow.prompt = () => "";
  e("manageShift()");
  eq(J("miniMartCurrentShift")?.id, "S", "open shift");
  eq(J("miniMartShiftHistory") || [], [], "closed shifts");
});

test("reports today: a 7 AM sale counts as today", async () => {
  await reportsAt(manila("2026-03-10T12:00:00"), [saleOn("a", "2026-03-10T07:00:00", 100)]);
  eq(text("todayRevenue"), "₱100.00", "today's revenue");
});

test("reports today: at 7:30 AM, yesterday's sale is not counted as today", async () => {
  await reportsAt(manila("2026-03-10T07:30:00"), [saleOn("a", "2026-03-09T17:00:00", 40)]);
  eq(text("todayRevenue"), "₱0.00", "today's revenue");
});

test("trends: the comparison uses yesterday's real sales", async () => {
  await reportsAt(manila("2026-03-10T12:00:00"), [saleOn("a", "2026-03-10T10:00:00", 150), saleOn("b", "2026-03-09T10:00:00", 100)]);
  has(text("todayRevenueNote"), "50% vs yesterday revenue", "revenue note");
});

test("trends: the 7-day trend shows all 7 days with the Today filter on", async () => {
  await reportsAt(manila("2026-03-10T12:00:00"), [saleOn("a", "2026-03-10T10:00:00", 150), saleOn("b", "2026-03-09T10:00:00", 100), saleOn("c", "2026-03-05T10:00:00", 25)]);
  eq(e("trendDayStats.map(d=>d.revenue)"), [0, 25, 0, 0, 0, 100, 150], "last 7 days");
});

test("void: with a category filter on, every item's stock comes back", async () => {
  await fresh();
  const product = (id, name, category, stock) => ({ id, name, category, price: 10, costPrice: 5, stock, unit: "piece", icon: "x", accent: "var(--gold)" });
  L("miniMartProducts", [product("p1", "Alpha", "Snacks", 8), product("p2", "Beta", "Dairy", 7)]);
  L("miniMartSales", [{
    id: "v1",
    date: new Date().toISOString(),
    items: [
      { name: "Alpha", price: 10, quantity: 2, category: "Snacks", productId: "p1" },
      { name: "Beta", price: 10, quantity: 3, category: "Dairy", productId: "p2" },
    ],
    total: 50,
    status: "completed",
  }]);
  await go("reports.html?period=all&category=Snacks");
  eq(e("reportCategory.value"), "Snacks", "filter in use");
  F.contentWindow.prompt = () => "APPROVE";
  e("voidSale('v1')");
  await sleep(350);
  const stock = (name) => J("miniMartProducts").find((item) => item.name === name).stock;
  eq([stock("Alpha"), stock("Beta")], [10, 10], "stock after the void");
});

test("exports: voided sales are left out", async () => {
  await fresh();
  L("miniMartSales", [{ ...saleOn("kept", "2026-03-10T10:00:00", 100) }, { ...saleOn("gone", "2026-03-10T11:00:00", 50), status: "voided" }]);
  await go("settings.html");
  $("reportExportData").value = "sales";
  $("salesRange").value = "all";
  eq(e("reportSales().map(s=>s.id)"), ["kept"], "exported sales");
});

test("hold: holding a cart clears the Suki customer", async () => {
  await fresh();
  L("miniMartSukis", [{ id: "s1", name: "Ana", phone: "", joined: "2026-01-01", nfcId: "", stamps: 12, rewardBalance: 12, active: true, history: [] }]);
  await go("index.html");
  e(`${coke}selectedSukiId='s1';updateSukiCheckoutInfo();holdCurrentCart();`);
  eq(e("selectedSukiId"), "", "selected customer");
});
