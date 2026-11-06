"use strict";
// Expiry and missing dates. Rule: missing data never removes points, and expiry is
// worked out on read, so reading a customer changes nothing that is stored.
const OLD = new Date(Date.now() - 200 * 864e5).toISOString();
const RECENT = new Date().toISOString();
const base = { phone: "", nfcId: "", active: true };
const CUSTOMERS = [
  { ...base, id: "a", name: "Recent", joined: "2026-10-01", stamps: 10, rewardBalance: 10, history: [{ stampsEarned: 10, date: RECENT }] },
  { ...base, id: "d", name: "OldEarn", joined: "2020-01-01", stamps: 15, rewardBalance: 15, history: [{ stampsEarned: 15, date: OLD }] },
  { ...base, id: "j", name: "OldJoinOnly", joined: "2020-01-01", stamps: 9, rewardBalance: 9, history: [] },
  { ...base, id: "e", name: "NoDates", joined: "", stamps: 7, rewardBalance: 7, history: [] },
  { ...base, id: "g", name: "BadDate", joined: "not-a-date", stamps: 6, rewardBalance: 6, history: [{ stampsEarned: 6, date: "nope" }] },
  { ...base, id: "f", name: "Empty", joined: "2020-01-01", stamps: 0, rewardBalance: 0, history: [] },
];
const usable = () => e("Object.fromEntries(sukiStore.read().map(s=>[s.name,sukiRules.usablePoints(s)]))");
const expiryOn = async (page = "index.html") => {
  await fresh();
  L("miniMartSukis", CUSTOMERS);
  L("miniMartSettings", { sukiPointsExpiry: "days", sukiPointsExpiryDays: 90 });
  await go(page);
};
const runPreview = async () => {
  const source = await fetch("/__tests/fixtures/suki-preview.js").then((reply) => reply.text());
  const pageConsole = F.contentWindow.console;
  const { log, table } = pageConsole;
  pageConsole.log = () => {};
  pageConsole.table = () => {};
  const report = F.contentWindow.eval(source);
  pageConsole.log = log;
  pageConsole.table = table;
  return report;
};

test("with expiry on, only customers with real old dates lose points", async () => {
  await expiryOn();
  eq(usable(), { Recent: 10, OldEarn: 0, OldJoinOnly: 0, NoDates: 7, BadDate: 6, Empty: 0 }, "usable points");
});

test("the rule treats missing dates as not expired", async () => {
  await expiryOn();
  eq(e("[sukiRules.expiryDate(null),sukiRules.expiryDate(undefined),sukiRules.expiryDate('nope'),sukiRules.isExpired(null),sukiRules.isExpired(undefined)]"), [null, null, null, false, false], "rule");
});

test("the preview script and the rules name the same customers", async () => {
  await expiryOn();
  const report = await runPreview();
  const expected = ["OldEarn", "OldJoinOnly"];
  eq(report.wouldLosePoints.map((row) => row.name), expected, "preview script");
  eq(e("sukiStore.read().filter(s=>s.stamps>0&&sukiRules.isExpired(sukiRules.pointsEntryDate(s))).map(s=>s.name)"), expected, "rules");
  eq(report.expiry, { turnedOn: true, days: 90, customers: 2, customersWithNoDates: 2, points: 24 }, "preview summary");
});

test("reading customers and running the preview changes no data", async () => {
  await expiryOn();
  const before = localStorage.miniMartSukis;
  usable();
  await runPreview();
  await go("suki-reward.html");
  eq(localStorage.miniMartSukis, before, "stored customers");
});

test("a customer with no dates keeps their points at Checkout", async () => {
  await expiryOn();
  e("selectedSukiId='e';addProductToCart(window.miniMartDB.products().find(p=>p.name==='Coke 1.5L'));updateSukiCheckoutInfo()");
  has(text("checkoutSukiInfo").replace(/\s+/g, " "), "7", "Checkout panel");
  eq(e("sukiRules.usablePoints(getSelectedSuki())"), 7, "usable points");
});

test("with expiry off, everyone keeps their points", async () => {
  await fresh();
  L("miniMartSukis", CUSTOMERS);
  L("miniMartSettings", { sukiPointsExpiry: "none" });
  await go("index.html");
  eq(usable(), { Recent: 10, OldEarn: 15, OldJoinOnly: 9, NoDates: 7, BadDate: 6, Empty: 0 }, "usable points");
});
