"use strict";
// Suki store. Rule: records without ids never wipe the list, ids are stable and do not
// depend on list position, the original is backed up once, and shorter saves are refused.
const raw = () => localStorage.miniMartSukis;
const S = () => JSON.parse(raw());
const keys = (prefix) => Object.keys(localStorage).filter((key) => key.startsWith(prefix));
const PRE = "miniMartSukis__premigration_";
const UNUSABLE = "miniMartSukis__unusable_";
const set = (value) => localStorage.setItem("miniMartSukis", typeof value === "string" ? value : JSON.stringify(value));
const OLD = '[{"name":"Old One","stamps":5},{"name":"Old Two","stamps":9}]';
const CORRUPT_BANNER = "A backup copy was saved. Check your browser storage before making changes.";
const cards = () => [...F.contentDocument.querySelectorAll(".suki-card")]
  .map((card) => `${card.querySelector(".suki-card-name").textContent.trim()} ${card.querySelector(".suki-card-stats strong").textContent.trim()}`);
const addUI = async (name) => {
  $("openAddSuki").click();
  await sleep(150);
  $("sukiName").value = name;
  $("sukiName").dispatchEvent(new F.contentWindow.Event("input", { bubbles: true }));
  $("addSukiForm").requestSubmit();
  await sleep(60);
};

test("customers with no id are listed, and adding one keeps them all", async () => {
  await fresh();
  set(OLD);
  await go("suki-reward.html");
  $("allSukisTab").click();
  eq(cards(), ["Old One 5/40 points", "Old Two 9/40 points"], "first load");
  await addUI("New Person");
  await go("suki-reward.html");
  $("allSukisTab").click();
  eq(cards(), ["New Person 0/40 points", "Old One 5/40 points", "Old Two 9/40 points"], "after add and reload");
  eq(S().map((suki) => [suki.name, suki.stamps]), [["Old One", 5], ["Old Two", 9], ["New Person", 0]], "stored");
});

test("every tab derives the same id, whatever the load order or list order", async () => {
  await fresh();
  set(OLD);
  const second = mkFrame();
  await go("suki-reward.html");
  await go("index.html", 450, second);
  const sukiTab = e("sukiStore.read().map(s=>s.id)");
  const checkoutTab = e("sukiStore.read().map(s=>s.id)", second);
  const stored = S().map((suki) => suki.id);
  await go("about:blank", 20, second);
  second.remove();
  eq(sukiTab, stored, "Suki tab");
  eq(checkoutTab, stored, "Checkout tab");
  await fresh();
  set(OLD);
  await go("index.html");
  eq(S().map((suki) => suki.id), stored, "Checkout loading first");
  await fresh();
  set('[{"name":"Old Two","stamps":9},{"name":"Old One","stamps":5}]');
  await go("suki-reward.html");
  eq(S().map((suki) => suki.id).reverse(), stored, "reversed list");
});

test("customers with the same name stay separate", async () => {
  await fresh();
  set('[{"name":"Maria"},{"name":"Maria"},{"name":"Maria"}]');
  await go("suki-reward.html");
  $("allSukisTab").click();
  const ids = S().map((suki) => suki.id);
  eq(new Set(ids).size, 3, "distinct ids");
  eq(cards().length, 3, "cards shown");
  await go("index.html");
  eq(S().map((suki) => suki.id), ids, "ids after reload");
});

test("the original list is backed up once, exactly", async () => {
  await fresh();
  set(OLD);
  await go("suki-reward.html");
  const backups = keys(PRE);
  eq(backups.length, 1, "backups");
  eq(localStorage[backups[0]], OLD, "backup value");
  for (const page of ["suki-reward.html", "index.html", "suki-reward.html"]) await go(page);
  eq(keys(PRE).length, 1, "backups after more loads");
});

test("a list that needs no migration is left byte-identical", async () => {
  await fresh();
  const list = '[{"id":"a1","name":"Ana","phone":"+639171234567","joined":"2026-01-02","nfcId":"AA:BB","stamps":12,"rewardBalance":12.5,"active":false,"history":[{"type":"Purchase","stampsEarned":1}],"redeemed":false,"extra":"kept"}]';
  set(list);
  await go("suki-reward.html");
  await go("index.html");
  eq(raw(), list, "stored value");
  eq(keys(PRE).length, 0, "backups");
});

test("over-limit values are stored exactly, and a sale to someone else leaves them alone", async () => {
  await fresh();
  set('[{"id":"x","name":"Cap","stamps":55,"rewardBalance":300,"phone":"","joined":"","nfcId":"","active":true,"history":[]},{"id":"y","name":"Buyer","stamps":0,"rewardBalance":0,"phone":"","joined":"","nfcId":"","active":true,"history":[]}]');
  await go("suki-reward.html");
  await go("index.html");
  e("selectedSukiId='y';addProductToCart(window.miniMartDB.products().find(p=>p.name==='Coke 1.5L'));amountGiven.value='500';updatePayment();completeSale();");
  await sleep(60);
  eq([S()[0].stamps, S()[0].rewardBalance], [55, 300], "untouched customer");
  eq(S()[1].stamps, 3, "buyer stamps");
});

test("a sale goes to the customer who was selected", async () => {
  await fresh();
  set(OLD);
  await go("index.html");
  const id = S()[1].id;
  e(`selectedSukiId=${JSON.stringify(id)};addProductToCart(window.miniMartDB.products().find(p=>p.name==='Coke 1.5L'));amountGiven.value='65';updatePayment();`);
  $("sellButton").click();
  $("confirmCheckoutSale").click();
  await sleep(60);
  eq([S()[0].name, S()[0].stamps, S()[0].history.length], ["Old One", 5, 0], "other customer");
  eq([S()[1].name, S()[1].stamps, S()[1].history.length], ["Old Two", 12, 1], "selected customer");
  eq(J("miniMartSales").length, 1, "sales");
});

test("deleting a customer removes only that customer", async () => {
  await fresh();
  set(OLD);
  await go("suki-reward.html");
  e(`openDeleteSuki(${JSON.stringify(S()[0].id)})`);
  $("confirmDeleteSuki").click();
  await sleep(50);
  eq(S().map((suki) => suki.name), ["Old Two"], "left");
});

test("saves that would lose customers are refused", async () => {
  await fresh();
  set(OLD);
  await go("suki-reward.html");
  const before = raw();
  eq(e("(()=>{const s=window.miniMartSukiStore;return s.save(s.read().slice(1)).ok})()"), false, "shorter save");
  eq(storageToast(), "1 customer record would have been lost, so nothing was saved.", "toast");
  eq(e("window.miniMartSukiStore.save([]).ok"), false, "empty save");
  eq(e("window.miniMartSukiStore.save('x').ok"), false, "invalid save");
  eq(raw(), before, "stored value");
});

test("a stale tab cannot drop a customer added elsewhere", async () => {
  await fresh();
  set(OLD);
  await go("suki-reward.html");
  const list = e("JSON.stringify(window.miniMartSukiStore.read())");
  set([...JSON.parse(list), { id: "other-tab", name: "Added Elsewhere" }]);
  eq(e(`window.miniMartSukiStore.save(${list}).ok`), false, "stale save");
  eq(S().map((suki) => suki.name), ["Old One", "Old Two", "Added Elsewhere"], "names");
});

for (const value of ["{bad", '{"wrong":true}']) {
  test(`an unreadable customer list is never overwritten: ${value}`, async () => {
    await fresh();
    set(value);
    await go("suki-reward.html");
    await addUI("Should Not Save");
    eq(banner(), CORRUPT_BANNER, "banner");
    eq(storageToast(), "The customer list could not be read, so nothing was saved. Your stored data was not changed.", "toast");
    eq(raw(), value, "stored value");
    eq(keys("miniMartSukis__corrupt_").length, 1, "backups");
    await go("index.html");
    e("addProductToCart(window.miniMartDB.products().find(p=>p.name==='Coke 1.5L'));amountGiven.value='500';updatePayment();completeSale();");
    await sleep(60);
    eq((J("miniMartSales") || []).length, 1, "sale without a customer");
    eq(raw(), value, "stored value after sale");
  });
}

test("records with no usable content are set aside, not lost", async () => {
  await fresh();
  const list = '[{"name":"Keep"},{},null,5,{"stamps":7},{"nfcId":"aa-bb"}]';
  set(list);
  await go("suki-reward.html");
  eq(S().map((suki) => [suki.name, suki.stamps, suki.nfcId]), [["Keep", 0, ""], ["", 7, ""], ["", 0, "AA:BB"]], "stored");
  eq(keys(UNUSABLE).length, 1, "set-aside backups");
  eq(localStorage[keys(UNUSABLE)[0]], "[{},null,5]", "set-aside value");
  eq(localStorage[keys(PRE)[0]], list, "original backup");
});

test("if the backup fails, nothing migrates and customers stay visible", async () => {
  await fresh();
  set(OLD);
  await go("about:blank", 10);
  await goEarly("suki-reward.html", (w) => {
    const original = w.Storage.prototype.setItem;
    w.Storage.prototype.setItem = function setItemFailing(key, value) {
      if (key.includes("__premigration_")) throw new w.DOMException("full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const message = "Customer records could not be upgraded because their backup failed. Nothing was changed.";
  eq(storageToast(), message, "toast");
  $("allSukisTab").click();
  eq(cards(), ["Old One 5/40 points", "Old Two 9/40 points"], "customers visible");
  await addUI("Blocked");
  eq(raw(), OLD, "stored value");
  eq(storageToast(), message, "refusal toast");
  eq(keys(PRE).length, 0, "backups");
});

test("duplicate and numeric ids are repaired", async () => {
  await fresh();
  set('[{"id":"d","name":"A"},{"id":"d","name":"B"},{"id":7,"name":"C"}]');
  await go("suki-reward.html");
  const stored = S().map((suki) => [suki.id, suki.name]);
  eq(stored[0], ["d", "A"], "first keeps its id");
  ok(stored[1][0] !== "d" && stored[1][0], `second has a new id: ${stored[1][0]}`);
  eq(stored[1][1], "B", "second name");
  eq(stored[2], ["7", "C"], "numeric id");
});

test("old records that arrive later, for example from another tab, are migrated on save", async () => {
  await fresh();
  await go("suki-reward.html");
  set(OLD);
  eq(e("(()=>{const s=window.miniMartSukiStore;return s.save(s.read()).ok})()"), true, "save");
  eq(keys(PRE).length, 1, "backups");
  ok(S().every((suki) => suki.id), "A customer has no id");
});

test("card ids are normalized and can be looked up", async () => {
  await fresh();
  set('[{"name":"Card","stamps":3,"nfcId":"aa-bb"}]');
  await go("suki-reward.html");
  eq(S()[0].nfcId, "AA:BB", "stored card id");
  eq(e("sukiStore.read().find(s=>s.nfcId===window.normalizeNfcId('AA-BB'))?.name"), "Card", "lookup");
});
