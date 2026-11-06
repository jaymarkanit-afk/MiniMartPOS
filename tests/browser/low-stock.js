"use strict";
// Low-stock results. Expected values were recorded from the app before the two
// lowStockThreshold copies were merged, so these prove the results did not change.
const product = (name, stock, restockMin) => ({
  id: name, name, category: "Snacks", price: 10, costPrice: 5, stock, unit: "piece", icon: "x", accent: "var(--gold)", restockMin,
});
const SAMPLES = [
  product("Own limit, under", 4, 5),
  product("Own limit, equal", 5, 5),
  product("Own limit, over", 6, 5),
  product("Text limit, under", 6, "7"),
  product("Zero limit, default low", 9, 0),
  product("Zero limit, default fine", 11, 0),
  product("Negative limit", 9, -3),
  product("Text junk limit", 9, "abc"),
  product("No limit, low", 10),
  product("No limit, fine", 11),
  product("Decimal limit", 2, 2.5),
  product("Out of stock", 0, 5),
];
const seedSamples = async (settings) => {
  await fresh();
  L("miniMartProducts", SAMPLES);
  L("miniMartDeletedProducts", ["Coke 1.5L", "Sprite 1.5L", "Nature's Spring 500ml", "Nestea Lemon 1L", "Lucky Me Pancit Canton", "Lucky Me Chicken Noodles", "Payless Xtra Big", "Nissin Cup Noodles", "Piattos 40g", "Chippy Barbecue 110g", "Choc Nut 24g", "Nova Country 78g", "Bear Brand 33g", "Alaska Fortified Milk 1L", "Selecta Ice Cream Cup", "Yakult 5-Pack", "Skyflakes Crackers"]);
  if (settings) L("miniMartSettings", settings);
};
const LOW_AT_10 = ["Own limit, under", "Own limit, equal", "Text limit, under", "Zero limit, default low", "Negative limit", "Text junk limit", "No limit, low", "Decimal limit", "Out of stock"];
const LOW_AT_3 = ["Own limit, under", "Own limit, equal", "Text limit, under", "Decimal limit", "Out of stock"];
const reportsLow = () => e("[...lowStockProductNames]");
const inventoryLow = () => {
  e("tbody.querySelectorAll('.category-group').forEach(g=>{g.dataset.open='true'});inventoryFilter.value='low';updateVisibleRows()");
  return [...F.contentDocument.querySelectorAll("tr[data-product]")]
    .filter((row) => !row.hidden && row.style.display !== "none")
    .map((row) => row.dataset.product);
};

for (const [limit, expected] of [[10, LOW_AT_10], [3, LOW_AT_3]]) {
  test(`Reports lists the same low-stock products with a store default of ${limit}`, async () => {
    await seedSamples({ lowStockThreshold: limit });
    await go("reports.html");
    eq(reportsLow(), expected, "low-stock products");
  });

  test(`Inventory lists the same low-stock products with a store default of ${limit}`, async () => {
    await seedSamples({ lowStockThreshold: limit });
    await go("inventory.html");
    eq(inventoryLow().sort(), [...expected].sort(), "low-stock products");
  });
}

test("with no settings saved, the store default is 10", async () => {
  await seedSamples();
  await go("reports.html");
  eq(reportsLow(), LOW_AT_10, "low-stock products");
});
