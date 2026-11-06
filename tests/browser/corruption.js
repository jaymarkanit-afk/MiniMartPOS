"use strict";
// Corruption handling. Rule: normal sales are never flagged, false backups are cleaned
// up, real corruption is kept and shown, and no failed copy can stop a sale.
const corrupt = () => Object.keys(localStorage).filter((key) => key.includes("__corrupt_")).sort();
const BACKUP_SAVED = "A backup copy was saved. Check your browser storage before making changes.";
const BACKUP_FAILED = "A backup copy could not be saved. Avoid making changes until your browser storage is checked.";
const addCoke = "addProductToCart(window.miniMartDB.products().find(p=>p.name==='Coke 1.5L'));";
const sellUI = async (setup = "") => {
  e(`${addCoke}${setup}updatePayment();`);
  $("sellButton").click();
  $("confirmCheckoutSale").click();
  await sleep(30);
};
const seedSuki = () => L("miniMartSukis", [{ id: "s1", name: "Ana", phone: "", joined: "2026-01-01", nfcId: "AA", stamps: 0, rewardBalance: 0, active: true, history: [] }]);
const line = { name: "Lucky Me Pancit Canton", price: 15, quantity: 2, productId: "product-lucky-me-pancit-canton", category: "Instant Food", unit: "piece", lineTotal: 30, costPrice: 11 };
const seedSale = (index) => ({ id: `TX-${index}`, date: new Date().toISOString(), items: [line, line, line], total: 90, transactionNumber: `TX-20261105010101-${index}`, paymentMethod: "cash", payments: { cash: 100, card: 0, gcash: 0 }, shiftId: "SHIFT-1", status: "completed", cashGiven: 100, cashRequired: 90, change: 10, rewardUsed: null });

test("five normal sales create no corruption backups and no banner", async () => {
  await fresh();
  seedSuki();
  await go("index.html");
  await sellUI("amountGiven.value='100';");
  await sellUI("amountGiven.value='70';");
  await sellUI("paymentMethod.value='card';updatePaymentMethodUI();amountGiven.value='65';");
  await sellUI("paymentMethod.value='gcash';updatePaymentMethodUI();amountGiven.value='65';");
  await sellUI("selectedSukiId='s1';paymentMethod.value='cash';updatePaymentMethodUI();amountGiven.value='65';");
  eq(e("window.miniMartDB.getStorageIssues().length"), 0, "storage issues");
  await go("reports.html");
  eq(J("miniMartSales").length, 5, "sales");
  eq(J("miniMartSukis")[0].stamps, 3, "stamps from a P65 sale");
  eq(corrupt(), [], "corrupt keys");
  eq(banner(), null, "banner");
});

test("false corruption backups are removed on load", async () => {
  await fresh();
  await go("index.html", 200);
  const products = localStorage.miniMartProducts;
  [["miniMartProducts__corrupt_1", products], ["miniMartProducts__corrupt_2", products], ["miniMartProducts__corrupt_3", products], ["miniMartSales__corrupt_1", '[{"id":"a"}]'], ["miniMartSukis__corrupt_1", "[]"]]
    .forEach(([key, value]) => L(key, value));
  L("miniMartSales", "[]");
  L("miniMartSukis", "[]");
  eq(corrupt().length, 5, "backups before");
  await go("about:blank", 20);
  logs = [];
  await go("index.html");
  eq(corrupt(), [], "backups after");
  eq(logs, ["Mini Mart storage: removed 5 false corruption backups."], "log");
  eq(banner(), null, "banner");
});

for (const page of ["index", "inventory", "reports", "settings"]) {
  test(`broken product data on ${page} is backed up, kept, and shown`, async () => {
    await fresh();
    L("miniMartProducts", "{bad");
    await go(`${page}.html`);
    ok(e("window.miniMartInitialDataReady"), "Page never became ready");
    eq(banner(), BACKUP_SAVED, "banner");
    eq(corrupt().length, 1, "backups");
    eq(localStorage.miniMartProducts, "{bad", "original value");
  });
}

test("broken product data on the Suki page is left untouched", async () => {
  // The Suki page never reads products, so it has nothing to flag or back up.
  await fresh();
  L("miniMartProducts", "{bad");
  await go("suki-reward.html");
  ok(e("window.miniMartInitialDataReady"), "Page never became ready");
  eq(localStorage.miniMartProducts, "{bad", "original value");
});

test("reloading with broken data keeps one backup", async () => {
  await fresh();
  L("miniMartProducts", "{bad");
  await go("index.html");
  await go("index.html");
  eq(corrupt().length, 1, "backups");
  eq(banner(), BACKUP_SAVED, "banner");
  eq(localStorage[corrupt()[0]], "{bad", "backup value");
});

test("data with the wrong shape is treated as corrupt", async () => {
  await fresh();
  L("miniMartProducts", '{"wrong":true}');
  await go("index.html");
  eq(banner(), BACKUP_SAVED, "banner");
  eq(corrupt().length, 1, "backups");
  eq(localStorage.miniMartProducts, '{"wrong":true}', "original value");
  await go("index.html");
  eq(corrupt().length, 1, "backups after reload");
});

test("real corruption backups survive cleanup", async () => {
  await fresh();
  await go("index.html", 200);
  L("miniMartProducts__corrupt_1", "{bad");
  L("miniMartProducts__corrupt_2", '{"wrong":true}');
  L("miniMartSales__corrupt_1", "[1,2]");
  L("miniMartCheckoutDraft__corrupt_1", '{"version":1}');
  L("miniMartProducts__corrupt_3", '[{"name":"False"}]');
  await go("index.html");
  eq(corrupt(), ["miniMartCheckoutDraft__corrupt_1", "miniMartProducts__corrupt_1", "miniMartProducts__corrupt_2", "miniMartSales__corrupt_1"], "backups left");
  eq(e("window.miniMartDB.removeFalseCorruptBackups()"), 0, "second cleanup");
});

test("the only good copy is kept while the live value is damaged", async () => {
  await fresh();
  L("miniMartProducts", "{bad");
  L("miniMartProducts__corrupt_1", '[{"name":"Only good copy"}]');
  await go("index.html");
  eq(localStorage.miniMartProducts__corrupt_1, '[{"name":"Only good copy"}]', "good copy");
});

test("a dismissed banner stays gone", async () => {
  await fresh();
  L("miniMartFavoriteProducts", "{bad");
  await go("index.html");
  eq(banner(), BACKUP_SAVED, "banner");
  F.contentDocument.querySelector("#storageWarning button").click();
  e("renderProducts();window.miniMartDB.readStorage('miniMartFavoriteProducts',[])");
  eq(banner(), null, "banner after dismiss");
});

test("old backups alone do not show the banner", async () => {
  await fresh();
  L("miniMartProducts__corrupt_1", "{bad");
  await go("index.html");
  eq(banner(), null, "banner");
  eq(corrupt(), ["miniMartProducts__corrupt_1"], "backups");
});

test("a failed corruption backup still lets the sale save", async () => {
  await fresh();
  L("miniMartFavoriteProducts", "{bad");
  await go("about:blank", 10);
  await goEarly("index.html", (w) => {
    const original = w.Storage.prototype.setItem;
    w.Storage.prototype.setItem = function setItemFailing(key, value) {
      if (key.includes("__corrupt_")) throw new w.DOMException("full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await sellUI("amountGiven.value='65';");
  eq((J("miniMartSales") || []).length, 1, "sales");
  eq(banner(), BACKUP_FAILED, "banner");
  eq(corrupt().length, 0, "backups");
  eq(F.contentDocument.querySelectorAll(".storage-error").length, 0, "error toasts");
});

for (const key of ["miniMartSales", "miniMartProducts", "miniMartSukis", "miniMartCurrentShift"]) {
  test(`a failed write to ${key} rolls the whole sale back`, async () => {
    await fresh();
    seedSuki();
    L("miniMartCurrentShift", { id: "S", openedAt: new Date().toISOString(), openingCash: 0, sales: 2, cashSales: 10 });
    L("miniMartSales", []);
    await go("index.html");
    const snap = () => JSON.stringify(["miniMartProducts", "miniMartSales", "miniMartSukis", "miniMartCurrentShift"].map((name) => localStorage[name]));
    const before = snap();
    const undo = failWrites((name) => name === key);
    await sellUI("selectedSukiId='s1';amountGiven.value='65';");
    eq(snap() === before, true, "storage unchanged");
    eq(e("cart.size"), 1, "cart kept");
    eq(e("saleInProgress"), false, "sale lock");
    ok(!$("sellButton").disabled, "Sell button is disabled");
    eq(checkoutToast(), "The sale could not be saved. Nothing was changed.", "toast");
    undo();
  });
}

test("a nearly full store still saves the sale and cleans up after itself", async () => {
  await fresh();
  L("filler", "x".repeat(4900000));
  seedSuki();
  L("miniMartFavoriteProducts", "{bad");
  await go("index.html", 500);
  eq(banner(), BACKUP_FAILED, "banner");
  await sellUI("amountGiven.value='65';");
  eq(corrupt().length, 0, "backups");
  ok(!("miniMartBackupHeadroomProbe" in localStorage), "Headroom probe left behind");
  eq((J("miniMartSales") || []).length, 1, "sales");
  eq(e("saleInProgress"), false, "sale lock");
});

test("a large corrupt value keeps only the newest backup", async () => {
  await fresh();
  const big = (character) => `{${character.repeat(600 * 1024)}`;
  L("miniMartSales", big("a"));
  await go("reports.html");
  eq(corrupt().length, 1, "first backup");
  L("miniMartSales", big("b"));
  await go("reports.html");
  eq(corrupt().length, 1, "backups after second corruption");
  eq(localStorage[corrupt()[0]][1], "b", "newest kept");
});

test("the same corruption is backed up once and a change is backed up again", async () => {
  await fresh();
  L("miniMartSales", "{one");
  await go("reports.html");
  await go("reports.html");
  eq(corrupt().length, 1, "same value twice");
  L("miniMartSales", "{two");
  await go("reports.html");
  eq(corrupt().length, 2, "after a different value");
});

for (const size of [1500, 3000, 5000]) {
  test(`sales keep saving with ${size} sales stored`, async () => {
    await fresh();
    L("miniMartSales", Array.from({ length: size }, (_, index) => seedSale(index)));
    await go("index.html", 300);
    let saved = 0;
    for (let index = 0; index < 6; index += 1) {
      const before = J("miniMartSales").length;
      await sellUI("amountGiven.value='100';");
      if (J("miniMartSales").length > before) saved += 1;
    }
    eq(saved, 6, "sales saved");
    eq(F.contentDocument.querySelectorAll(".storage-error").length, 0, "error toasts");
    eq(corrupt().length, 0, "corrupt keys");
    eq(banner(), null, "banner");
  }, { timeout: 90000 });
}

test("the backup file never includes corruption backups", async () => {
  await fresh();
  L("miniMartProducts__corrupt_1", "{bad");
  await go("settings.html");
  ok(!e("JSON.stringify(readBackupData())").includes("__corrupt_"), "Backup data contains __corrupt_");
});
