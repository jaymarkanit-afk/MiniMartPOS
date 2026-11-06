"use strict";
// Suki points. Rules: stamps is the only stored points value and the balance is worked
// out from it, history always adds up to the stored points, expiry is worked out on read
// and written at the next write, voids use what the sale recorded, and the migration
// runs once, behind a backup.
const coke = "addProductToCart(window.miniMartDB.products().find(p=>p.name==='Coke 1.5L'));";
const NOW = new Date().toISOString();
const OLD = new Date(Date.now() - 200 * 864e5).toISOString();
const customer = (overrides = {}) => {
  const stamps = overrides.stamps ?? 30;
  return {
    id: "c1",
    name: "Ana",
    phone: "",
    joined: "2026-01-01",
    nfcId: "AA:BB",
    stamps,
    active: true,
    history: stamps ? [{ type: "Purchase", stampsEarned: stamps, rewardUsed: 0, date: NOW }] : [],
    ...overrides,
  };
};
const saveCustomers = (...list) => L("miniMartSukis", list);
const S = (id = "c1") => J("miniMartSukis").find((suki) => suki.id === id);
const expiryOn = () => L("miniMartSettings", { sukiPointsExpiry: "days", sukiPointsExpiryDays: 90 });
const historyTotal = (id = "c1") => e(`window.miniMartSukiRules.historyPoints(window.miniMartSukiStore.read().find(s=>s.id==='${id}'))`);
const keys = (prefix) => Object.keys(localStorage).filter((key) => key.startsWith(prefix));
const BACKUP_PREFIX = "miniMartSukis__pointsBackup_";

const sell = async ({ reward = 0, given, id = "c1", items = coke, mustComplete = true } = {}) => {
  e(`selectedSukiId=${JSON.stringify(id)};${items}updateSukiCheckoutInfo();document.getElementById('rewardAmount').value='${reward}';amountGiven.value='${given}';updatePayment();`);
  $("sellButton").click();
  const refused = $("paymentError")?.textContent || "";
  const count = (J("miniMartSales") || []).length;
  $("confirmCheckoutSale").click();
  await sleep(40);
  const sales = J("miniMartSales") || [];
  if (mustComplete && sales.length !== count + 1) throw new Error(`The sale did not complete, reward ${reward}, given ${given}. ${refused}`);
  return sales.at(-1);
};
const voidOnReports = async (saleId, { reloads = true } = {}) => {
  await go("reports.html?period=all");
  F.contentWindow.prompt = () => "APPROVE";
  const alerts = [];
  F.contentWindow.__beforeVoid = true;
  e(`voidSale(${JSON.stringify(saleId)})`);
  const deadline = Date.now() + (reloads ? 8000 : 200);
  while (F.contentWindow.__beforeVoid && Date.now() < deadline) {
    if (dialog()) {
      alerts.push(dialog().textContent);
      dialog().querySelector(".is-confirm").click();
    }
    await sleep(10);
  }
  await waitForPage(F);
  return alerts;
};

test("30 points, redeem 10 on a P65 sale leaves 22, and the sale records both", async () => {
  await fresh();
  saveCustomers(customer());
  await go("index.html");
  const sale = await sell({ reward: 10, given: 55 });
  eq(S().stamps, 22, "points");
  eq([sale.sukiId, sale.pointsEarned, sale.pointsSpent], ["c1", 2, 10], "recorded on the sale");
  const entry = S().history.at(-1);
  eq([entry.saleId, entry.stampsEarned, entry.pointsSpent, entry.stampsAfter], [sale.id, 2, 10, 22], "history entry");
});

test("history adds up through earn, redeem, void and expire", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 12 }));
  await go("index.html");
  eq(historyTotal(), 12, "start");
  await sell({ given: 65 });
  eq([S().stamps, historyTotal()], [15, 15], "after earning");
  const second = await sell({ reward: 10, given: 55 });
  eq([S().stamps, historyTotal()], [7, 7], "after redeeming");
  await voidOnReports(second.id);
  eq(S().stamps, 15, "after the void");
  eq(historyTotal(), 15, "history after the void");
  const aged = S();
  aged.history = aged.history.map((entry) => ({ ...entry, date: OLD }));
  saveCustomers(aged);
  L("miniMartSettings", { sukiPointsExpiry: "days", sukiPointsExpiryDays: 90 });
  await go("index.html");
  await sell({ given: 65 });
  eq(S().stamps, 3, "after expiry and a new sale");
  eq(historyTotal(), 3, "history after expiry");
});

test("the Suki list, detail, Checkout and card scan all show the same balance", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 20, rewardBalance: 5 }));
  const stubCardReader = (w) => {
    w.NDEFReader = class {};
    Object.defineProperty(w, "scanNfcCard", { configurable: true, get: () => async (found) => found("AA:BB"), set() {} });
  };
  await goEarly("suki-reward.html", stubCardReader);
  e("scanExistingSuki()");
  await sleep(50);
  has(text("scanStatus"), "₱20.00", "scan");
  await go("suki-reward.html");
  has(text("sukiTotalRewards"), "₱20.00", "total");
  $("allSukisTab").click();
  has(F.contentDocument.querySelector(".suki-card").textContent, "₱20.00", "list");
  e("showSukiDetails('c1')");
  has([...F.contentDocument.querySelectorAll(".suki-reward-stat")].find((stat) => stat.textContent.includes("Reward Balance"))?.textContent, "₱20.00", "detail");
  await go("index.html");
  e(`selectedSukiId='c1';${coke}updateSukiCheckoutInfo()`);
  has(text("checkoutSukiInfo"), "₱20.00", "Checkout");
});

test("the ready-to-redeem filter and count use the derived balance", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 20, rewardBalance: 0 }), customer({ id: "c2", name: "Ben", stamps: 3, rewardBalance: 50, nfcId: "" }));
  await go("suki-reward.html");
  eq(text("sukiReadyRewards"), "1", "ready count");
  eq(text("sukiTotalRewards").replace(/\s/g, ""), "₱23.00", "total rewards");
});

test("the amount that can be spent never exceeds what is shown", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 12 }));
  await go("index.html");
  e(`selectedSukiId='c1';${coke}updateSukiCheckoutInfo();document.getElementById('rewardAmount').value='1000';updatePayment();`);
  eq(e("appliedReward(getCartTotal())"), 12, "applied reward");
  ok(Number($("rewardAmount").max) <= 12, `max is ${$("rewardAmount").max}`);
  has(text("checkoutSukiInfo"), "₱12.00", "shown");
});

test("earning stops at 40", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 39 }));
  await go("index.html");
  await sell({ given: 65 });
  eq(S().stamps, 40, "points at the cap");
  await sell({ given: 65 });
  eq(S().stamps, 40, "points stay at the cap");
});

test("a customer with 55 points over the cap keeps them", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 55 }));
  await go("index.html");
  await sell({ given: 65 });
  eq(S().stamps, 55, "after a sale with no redeem");
  await sell({ reward: 10, given: 55 });
  eq(S().stamps, 45, "redeeming spends 10, and nothing is lost to the cap");
  eq(historyTotal(), 45, "history");
});

test("changing the peso value revalues the balance everywhere", async () => {
  await fresh();
  L("miniMartSettings", { sukiPesoValue: 2 });
  saveCustomers(customer({ stamps: 12, rewardBalance: 12 }));
  await go("suki-reward.html");
  has(text("sukiTotalRewards"), "₱24.00", "Suki total");
  $("allSukisTab").click();
  has(F.contentDocument.querySelector(".suki-card").textContent, "₱24.00", "list");
  await go("index.html");
  e(`selectedSukiId='c1';${coke}updateSukiCheckoutInfo()`);
  has(text("checkoutSukiInfo"), "₱24.00", "Checkout");
});

test("with expiry off, old points stay spendable", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 15, history: [{ stampsEarned: 15, date: OLD }] }));
  await go("index.html");
  await sell({ reward: 10, given: 55 });
  eq(S().stamps, 7, "points");
});

test("with expiry on, expired points show as zero and stored data is untouched", async () => {
  await fresh();
  expiryOn();
  saveCustomers(customer({ stamps: 15, history: [{ stampsEarned: 15, date: OLD }] }));
  const before = localStorage.miniMartSukis;
  await go("index.html");
  e(`selectedSukiId='c1';${coke}updateSukiCheckoutInfo()`);
  has(text("checkoutSukiInfo"), "₱0.00", "Checkout");
  await go("suki-reward.html");
  eq(localStorage.miniMartSukis, before, "stored customers");
});

test("an expired customer shows 0 points on every screen", async () => {
  await fresh();
  expiryOn();
  saveCustomers(customer({ stamps: 15, history: [{ stampsEarned: 15, date: OLD }] }));
  await go("suki-reward.html");
  $("allSukisTab").click();
  has(F.contentDocument.querySelector(".suki-card").textContent.replace(/\s+/g, " "), "0/40 points", "list");
  e("showSukiDetails('c1')");
  ok(!F.contentDocument.body.textContent.includes("15/40"), "The detail still shows the expired points");
  await go("index.html");
  e(`selectedSukiId='c1';${coke}updateSukiCheckoutInfo()`);
  has(text("checkoutSukiInfo"), "0/40 points", "Checkout");
});

test("a customer with no dates keeps their points through a sale, with expiry on", async () => {
  await fresh();
  expiryOn();
  saveCustomers(customer({ stamps: 7, joined: "", history: [] }));
  await go("index.html");
  await sell({ given: 65 });
  eq(S().stamps, 10, "points");
  eq(S().history.filter((entry) => entry.type === "Points expired").length, 0, "expiry entries");
});

test("expired points do not come back after a new purchase", async () => {
  await fresh();
  expiryOn();
  saveCustomers(customer({ stamps: 15, history: [{ stampsEarned: 15, date: OLD }] }));
  await go("index.html");
  await sell({ given: 65 });
  eq(S().stamps, 3, "only the new points");
  eq(S().history.filter((entry) => entry.type === "Points expired").map((entry) => entry.pointsExpired), [15], "expiry entry");
  await sell({ given: 65 });
  eq(S().stamps, 6, "second sale");
  eq(S().history.filter((entry) => entry.type === "Points expired").length, 1, "one expiry entry only");
});

test("the expiry entry is written at the next edit of that customer", async () => {
  await fresh();
  expiryOn();
  saveCustomers(customer({ stamps: 15, history: [{ stampsEarned: 15, date: OLD }] }), customer({ id: "c2", name: "Ben", stamps: 5, nfcId: "" }));
  await go("suki-reward.html");
  e("(()=>{const list=sukiStore.read();list[0].phone='0917';sukiStore.save(list)})()");
  eq([S().stamps, S().history.at(-1).type], [0, "Points expired"], "edited customer");
  eq(S("c2").stamps, 5, "other customer");
});

test("a plain read writes nothing to storage", async () => {
  await fresh();
  expiryOn();
  saveCustomers(customer({ stamps: 15, history: [{ stampsEarned: 15, date: OLD }] }), customer({ id: "c2", name: "Ben", stamps: 5, nfcId: "" }));
  await go("index.html");
  await go("suki-reward.html", 500);
  ok(!F.contentWindow.__c.set.includes("miniMartSukis"), "Suki page wrote customers");
  await go("index.html", 500);
  ok(!F.contentWindow.__c.set.includes("miniMartSukis"), "Checkout wrote customers");
});

test("only applyPointsChange can change points or history", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 15 }));
  await go("suki-reward.html");
  e("(()=>{const list=sukiStore.read();list[0].stamps=99;list[0].history=[];list[0].phone='0917';sukiStore.save(list)})()");
  eq([S().stamps, S().history.length, S().phone], [15, 1, "0917"], "stored customer");
  const result = e("sukiStore.applyPointsChange('c1',{kind:'earn',points:2})");
  eq(result.ok, true, "direct change");
  eq(S().stamps, 17, "points");
});

test("a void returns spent points and removes earned points", async () => {
  await fresh();
  saveCustomers(customer());
  await go("index.html");
  const sale = await sell({ reward: 10, given: 55 });
  await voidOnReports(sale.id);
  eq(S().stamps, 30, "points");
  const entry = S().history.at(-1);
  eq([entry.type, entry.saleId, entry.pointsReversed, entry.pointsReturned, entry.shortfall], ["Sale voided", sale.id, 2, 10, 0], "history entry");
});

test("a void uses the values on the sale, not today's settings", async () => {
  await fresh();
  saveCustomers(customer());
  await go("index.html");
  const sale = await sell({ reward: 10, given: 55 });
  L("miniMartSettings", { sukiPesoValue: 5, sukiPesosPerPoint: 1 });
  await voidOnReports(sale.id);
  eq(S().stamps, 30, "points");
});

test("voiding the same sale twice does nothing the second time", async () => {
  await fresh();
  saveCustomers(customer());
  await go("index.html");
  const sale = await sell({ reward: 10, given: 55 });
  await voidOnReports(sale.id);
  const once = localStorage.miniMartSukis;
  await voidOnReports(sale.id, { reloads: false });
  eq(localStorage.miniMartSukis, once, "customers");
  e(`window.miniMartSukiStore.applyPointsChange("c1",{kind:"void-reverse",saleId:${JSON.stringify(sale.id)},earned:2,spent:10})`);
  eq(localStorage.miniMartSukis, once, "a repeat of the change itself");
});

test("a void floors at zero and records the shortfall", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 0 }));
  await go("index.html");
  const sale = await sell({ given: 65 });
  const spent = S();
  spent.stamps = 1;
  saveCustomers(spent);
  await voidOnReports(sale.id);
  eq(S().stamps, 0, "points");
  eq(S().history.at(-1).shortfall, 2, "shortfall");
});

const oldSale = (overrides = {}) => ({
  id: "old1",
  date: NOW,
  items: [{ name: "Coke 1.5L", price: 65, quantity: 1, lineTotal: 65, category: "Beverages" }],
  total: 65,
  status: "completed",
  cashRequired: 55,
  rewardUsed: 10,
  ...overrides,
});
const oldEntry = { type: "Purchase", date: NOW, purchaseTotal: 65, rewardUsed: 10, cashRequired: 55, stampsEarned: 2, stampsAfter: 22 };

test("a void on an old sale uses its matching history entry", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 22, history: [{ stampsEarned: 30, rewardUsed: 0, date: NOW }, oldEntry] }));
  L("miniMartSales", [oldSale()]);
  await voidOnReports("old1");
  eq(S().stamps, 30, "points");
  eq(J("miniMartSales")[0].status, "voided", "status");
});

test("a void on an old sale that cannot be matched leaves points alone and says so", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 22, history: [{ stampsEarned: 22, rewardUsed: 0, date: NOW }] }));
  L("miniMartSales", [oldSale()]);
  const before = localStorage.miniMartSukis;
  const alerts = await voidOnReports("old1");
  eq(localStorage.miniMartSukis, before, "customers");
  has(alerts.join(" "), "points were not changed", "message");
  eq(J("miniMartSales")[0].status, "voided", "status");
});

test("a void matching two customers leaves points alone and says so", async () => {
  await fresh();
  saveCustomers(
    customer({ stamps: 22, history: [oldEntry] }),
    customer({ id: "c2", name: "Ben", stamps: 22, nfcId: "", history: [oldEntry] }),
  );
  L("miniMartSales", [oldSale()]);
  const before = localStorage.miniMartSukis;
  const alerts = await voidOnReports("old1");
  eq(localStorage.miniMartSukis, before, "customers");
  has(alerts.join(" "), "points were not changed", "message");
});

for (const key of ["miniMartSales", "miniMartProducts", "miniMartSukis"]) {
  test(`a void that cannot write ${key} leaves sale, stock and points unchanged`, async () => {
    await fresh();
    saveCustomers(customer());
    await go("index.html");
    const sale = await sell({ reward: 10, given: 55 });
    await go("reports.html?period=all");
    F.contentWindow.prompt = () => "APPROVE";
    const names = ["miniMartSales", "miniMartProducts", "miniMartSukis"];
    const before = names.map((name) => localStorage[name]);
    const undo = failWrites((name) => name === key);
    e(`voidSale(${JSON.stringify(sale.id)})`);
    await sleep(250);
    undo();
    eq(names.map((name) => localStorage[name]), before, "storage");
  });
}

test("a sale that cannot write customers changes nothing", async () => {
  await fresh();
  saveCustomers(customer());
  await go("index.html");
  const names = ["miniMartSales", "miniMartProducts", "miniMartSukis"];
  const before = names.map((name) => localStorage[name]);
  const undo = failWrites((name) => name === "miniMartSukis");
  await sell({ reward: 10, given: 55, mustComplete: false });
  undo();
  eq(names.map((name) => localStorage[name]), before, "storage");
  eq(e("saleInProgress"), false, "sale lock");
});

test("a points change that cannot save returns a failure and changes nothing", async () => {
  await fresh();
  saveCustomers(customer());
  await go("suki-reward.html");
  const before = localStorage.miniMartSukis;
  const undo = failWrites((name) => name === "miniMartSukis");
  const result = e("sukiStore.applyPointsChange('c1',{kind:'earn',points:2})");
  undo();
  eq(result.ok, false, "result");
  eq(localStorage.miniMartSukis, before, "stored customers");
});

test("an edit that cannot save leaves points, history and the expiry entry unwritten", async () => {
  await fresh();
  expiryOn();
  saveCustomers(customer({ stamps: 15, history: [{ stampsEarned: 15, date: OLD }] }));
  await go("suki-reward.html");
  const before = localStorage.miniMartSukis;
  const undo = failWrites((name) => name === "miniMartSukis");
  e("(()=>{const list=sukiStore.read();list[0].phone='0917';sukiStore.save(list)})()");
  undo();
  eq(localStorage.miniMartSukis, before, "stored customers");
});

test("a sale that cannot write sales changes no points", async () => {
  await fresh();
  saveCustomers(customer());
  await go("index.html");
  const names = ["miniMartSales", "miniMartProducts", "miniMartSukis"];
  const before = names.map((name) => localStorage[name]);
  const undo = failWrites((name) => name === "miniMartSales");
  await sell({ reward: 10, given: 55, mustComplete: false });
  undo();
  eq(names.map((name) => localStorage[name]), before, "storage");
});

test("a sale that cannot write stock changes no points", async () => {
  await fresh();
  saveCustomers(customer());
  await go("index.html");
  const names = ["miniMartSales", "miniMartProducts", "miniMartSukis"];
  const before = names.map((name) => localStorage[name]);
  const undo = failWrites((name) => name === "miniMartProducts");
  await sell({ reward: 10, given: 55, mustComplete: false });
  undo();
  eq(names.map((name) => localStorage[name]), before, "storage");
});

test("the migration is switched off and does not run on load", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 5, rewardBalance: 20 }));
  await go("suki-reward.html");
  await go("index.html");
  eq([S().stamps, S().rewardBalance], [5, 20], "stored customer");
  eq(keys(BACKUP_PREFIX), [], "backups");
  eq(e("sukiStore.migrationEnabled"), false, "switch");
});

test("before the migration, the old balance moves with each points change", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 30, rewardBalance: 50 }));
  await go("index.html");
  await sell({ reward: 10, given: 55 });
  eq([S().stamps, S().rewardBalance], [22, 42], "both moved by the same value");
});

test("the migration keeps the higher value and adds a correction entry only where needed", async () => {
  await fresh();
  saveCustomers(
    customer({ id: "up", stamps: 5, rewardBalance: 20, nfcId: "1" }),
    customer({ id: "same", stamps: 8, rewardBalance: 8, nfcId: "2" }),
    customer({ id: "down", stamps: 12, rewardBalance: 3, nfcId: "3" }),
    customer({ id: "off", stamps: 9, rewardBalance: 9, nfcId: "4", history: [] }),
  );
  await go("suki-reward.html");
  const report = e("sukiStore.runPointsMigration()");
  eq(report.ok, true, "result");
  eq(["up", "same", "down", "off"].map((id) => S(id).stamps), [20, 8, 12, 9], "points");
  ok(["up", "same", "down", "off"].every((id) => !("rewardBalance" in S(id))), "An old balance is still stored");
  const corrections = (id) => S(id).history.filter((entry) => entry.type === "Balance correction");
  eq(corrections("same").length + corrections("down").length, 0, "customers who add up");
  const entry = corrections("up")[0];
  eq([entry.oldStamps, entry.oldRewardBalance, entry.newStamps], [5, 20, 20], "correction values");
  eq(corrections("off").map((item) => item.newStamps), [9], "correction for missing history");
  ["up", "same", "down", "off"].forEach((id) => eq(historyTotal(id), S(id).stamps, `history for ${id}`));
});

test("the migration converts the balance using the peso value", async () => {
  await fresh();
  L("miniMartSettings", { sukiPesoValue: 2 });
  saveCustomers(customer({ stamps: 5, rewardBalance: 21 }));
  await go("suki-reward.html");
  e("sukiStore.runPointsMigration()");
  eq(S().stamps, 11, "P21 at P2 a point rounds up to 11 points");
});

test("the migration backs up the raw list first, exactly", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 5, rewardBalance: 20 }));
  const original = localStorage.miniMartSukis;
  await go("suki-reward.html");
  e("sukiStore.runPointsMigration()");
  eq(keys(BACKUP_PREFIX).length, 1, "backups");
  eq(localStorage[keys(BACKUP_PREFIX)[0]], original, "backup value");
});

test("the migration refuses to run if the backup cannot be written", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 5, rewardBalance: 20 }));
  const original = localStorage.miniMartSukis;
  await go("suki-reward.html");
  const undo = failWrites((name) => name.startsWith(BACKUP_PREFIX));
  const report = e("sukiStore.runPointsMigration()");
  undo();
  eq(report.ok, false, "result");
  eq(localStorage.miniMartSukis, original, "stored customers");
});

test("the migration leaves everything alone if its own write fails", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 5, rewardBalance: 20 }));
  const original = localStorage.miniMartSukis;
  await go("suki-reward.html");
  const undo = failWrites((name) => name === "miniMartSukis");
  const report = e("sukiStore.runPointsMigration()");
  undo();
  eq(report.ok, false, "result");
  eq(localStorage.miniMartSukis, original, "stored customers");
});

test("a second migration run changes nothing", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 5, rewardBalance: 20 }));
  await go("suki-reward.html");
  e("sukiStore.runPointsMigration()");
  const once = localStorage.miniMartSukis;
  const report = e("sukiStore.runPointsMigration()");
  eq(report.changed, 0, "changed");
  eq(localStorage.miniMartSukis, once, "stored customers");
  eq(keys(BACKUP_PREFIX).length, 1, "backups");
});

test("new customers and migrated customers have no stored balance", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 5 }));
  await go("suki-reward.html");
  e("(()=>{const list=sukiStore.read();list.push({id:'n',name:'New',stamps:0,history:[]});sukiStore.save(list)})()");
  ok(!("rewardBalance" in S("n")), "New customer has a stored balance");
  ok(!("rewardBalance" in S("c1")), "Old customer gained a stored balance");
});

test("an old backup containing rewardBalance restores and shows the derived balance", async () => {
  await fresh();
  await go("settings.html");
  const data = JSON.parse(e("JSON.stringify(readBackupData())"));
  data.customers = [customer({ stamps: 12, rewardBalance: 40 })];
  e(`restoreBackupData(${JSON.stringify(data)})`);
  await go("suki-reward.html");
  eq([S().stamps, S().rewardBalance], [12, 40], "stored until the migration");
  has(text("sukiTotalRewards"), "₱12.00", "shown");
  e("sukiStore.runPointsMigration()");
  eq(S().stamps, 40, "points after the migration");
});

test("two open tabs agree, and a stale tab cannot undo points", async () => {
  await fresh();
  saveCustomers(customer({ stamps: 20 }));
  const second = mkFrame();
  await go("suki-reward.html");
  await go("index.html", 300, second);
  const stale = e("JSON.stringify(sukiStore.read())");
  e("sukiStore.applyPointsChange('c1',{kind:'earn',points:3})", second);
  eq(e("sukiRules.balance(sukiStore.read()[0])"), e("sukiRules.balance(sukiStore.read()[0])", second), "both tabs");
  e(`sukiStore.save(${stale})`);
  await go("about:blank", 20, second);
  second.remove();
  eq(S().stamps, 23, "points after the stale save");
});
