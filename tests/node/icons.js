"use strict";
// Category icons, with real mouse and keyboard input so the tooltip is proven in Chrome.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../lib/server");
const { sleep } = require("../lib/cdp");

const ALLOWED = {
  amenities: ["Icons/amenities.png", "Amenities"],
  beverages: ["Icons/beverages.png", "Beverages"],
  bread: ["Icons/bread.png", "Bread"],
  cannedFood: ["Icons/canned-food.png", "Canned Food"],
  cigarette: ["Icons/cigarette.png", "Cigarettes"],
  dairy: ["Icons/dairy.png", "Dairy"],
  detergent: ["Icons/detergent.png", "Household & Cleaning"],
  frozenGoods: ["Icons/frozengoods.png", "Frozen Goods"],
  instantFood: ["Icons/instant-food.png", "Instant Food"],
  riceGrains: ["Icons/rice&grains.png", "Rice & Grains"],
  sauces: ["Icons/sauces.png", "Sauces & Oils"],
  schoolSupplies: ["Icons/school_supplies.png", "School Supplies"],
  snacks: ["Icons/snacks.png", "Snacks"],
  sweets: ["Icons/sweets.png", "Sweets"],
};
const LEGACY = {
  "cooking-oil": "sauces",
  cookingOil: "sauces",
  "Icons/cooking-oil.svg": "sauces",
  "grains-rice": "riceGrains",
  grainsRice: "riceGrains",
  "Icons/grains-rice.svg": "riceGrains",
  household: "detergent",
  "Icons/household.svg": "detergent",
  "meat-fish": "frozenGoods",
  meatFish: "frozenGoods",
  "Icons/meat-fish.svg": "frozenGoods",
  toiletries: "amenities",
  "Icons/toiletries.svg": "amenities",
  groceryStore: "cannedFood",
  "Icons/grocery-store.png": "cannedFood",
  vegetables: "cannedFood",
  "Icons/vegetables.svg": "cannedFood",
};
const TAMPERED = [
  '<img src=x onerror="window.__pwned=1">',
  '"><script>window.__pwned=1</script>',
  "javascript:window.__pwned=1",
  "../../secret.png",
  "Icons/evil.svg",
  "constructor",
  "__proto__",
  "toString",
  42,
  null,
  { path: "Icons/evil.svg" },
];

const same = (actual, expected, label) => {
  const [a, b] = [JSON.stringify(actual), JSON.stringify(expected)];
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`.slice(0, 700));
};
const noFailedRequests = (server) => {
  const failed = server.requests.filter(({ status }) => status >= 400).map(({ url, status }) => `${status} ${url}`);
  server.requests.length = 0;
  if (failed.length) throw new Error(`Failed requests: ${failed.join(", ")}`);
};
const pickerState = (page, selector) => page.eval((target) => [...document.querySelectorAll(target)].map((button) => {
  const image = button.querySelector("img");
  return {
    label: button.dataset.label,
    path: decodeURI(new URL(image.src).pathname.slice(1)),
    loaded: image.complete && image.naturalWidth > 0,
  };
}), selector);
const expectedPicker = () => Object.values(ALLOWED)
  .map(([iconPath, label]) => ({ label, path: iconPath, loaded: true }));
const tooltip = (page) => page.eval(() => {
  const shown = [...document.querySelectorAll(".category-icon-tooltip")];
  if (shown.length !== 1) return { count: shown.length };
  const rect = shown[0].getBoundingClientRect();
  return { count: 1, text: shown[0].textContent, onScreen: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight };
});

const INVENTORY = {
  name: "Inventory",
  selector: "#categoryIconPicker .icon-option",
  async open(page) {
    await page.seed();
    await page.goto("inventory.html");
    await page.click("#createCategory");
    await page.until("document.querySelectorAll('#categoryIconPicker .icon-option').length>0", { label: "the icon picker" });
    await page.eval("Promise.all([...document.querySelectorAll('#categoryIconPicker img')].map(i=>i.decode().catch(()=>{})))");
  },
};
const SETTINGS = {
  name: "Settings",
  selector: ".category-management-icon-editor .category-icon-option",
  group: 0,
  async open(page) {
    await page.seed();
    await page.goto("settings.html");
    await page.eval("document.getElementById('openCategoryManagement').click()");
    await page.until("document.querySelectorAll('.category-management-icon-editor').length>0", { label: "the category list" });
    await page.eval("(()=>{const e=document.querySelector('.category-management-icon-editor');e.open=true;e.closest('.category-management-edit-panel').open=true})()");
    await page.eval("Promise.all([...document.querySelectorAll('.category-management-icon-editor img')].map(i=>i.decode().catch(()=>{})))");
  },
  // Every category has its own picker. Only the first is open.
  firstGroup: 14,
};

const tests = [];

tests.push({
  name: "every allowed icon exists on disk, and the list has exactly 14",
  run: async ({ page }) => {
    await page.seed();
    await page.goto("inventory.html");
    const options = await page.eval("window.miniMartDB.categoryIconOptions()");
    same(options.map(({ id, path: iconPath, label }) => [id, iconPath, label]), Object.entries(ALLOWED).map(([id, [iconPath, label]]) => [id, iconPath, label]), "allowlist");
    options.forEach(({ path: iconPath }) => {
      if (!fs.existsSync(path.join(ROOT, iconPath))) throw new Error(`Missing file: ${iconPath}`);
      if (!iconPath.endsWith(".png")) throw new Error(`Not a PNG: ${iconPath}`);
    });
  },
});

for (const screen of [INVENTORY, SETTINGS]) {
  tests.push({
    name: `${screen.name} picker shows exactly the 14 icons, with no cart and none broken`,
    run: async ({ page, server }) => {
      await screen.open(page);
      const state = await pickerState(page, screen.selector);
      same(state.slice(0, 14), expectedPicker(), "picker");
      if (screen === INVENTORY) same(state.length, 14, "options");
      if (state.some(({ path: iconPath }) => iconPath.includes("grocery-store"))) throw new Error("Cart icon is in the picker");
      noFailedRequests(server);
    },
  });
  tests.push({
    name: `${screen.name} tooltip shows the right label on hover`,
    run: async ({ page }) => {
      await screen.open(page);
      const labels = Object.values(ALLOWED).map(([, label]) => label);
      for (let index = 0; index < labels.length; index += 1) {
        await page.hover(screen.selector, index);
        await sleep(30);
        same(await tooltip(page), { count: 1, text: labels[index], onScreen: true }, `hover ${index}`);
      }
      await page.moveAway();
      await sleep(30);
      same(await tooltip(page), { count: 0 }, "after the mouse leaves");
    },
  });
  tests.push({
    name: `${screen.name} tooltip shows the right label on keyboard focus`,
    run: async ({ page }) => {
      await screen.open(page);
      const labels = Object.values(ALLOWED).map(([, label]) => label);
      await page.moveAway();
      await page.eval((selector) => document.querySelectorAll(selector)[0].focus(), screen.selector);
      await sleep(30);
      same(await tooltip(page), { count: 1, text: labels[0], onScreen: true }, "first icon");
      for (let index = 1; index < labels.length; index += 1) {
        await page.pressTab();
        await sleep(30);
        same(await tooltip(page), { count: 1, text: labels[index], onScreen: true }, `Tab to icon ${index}`);
      }
      await page.eval("document.activeElement.blur()");
      await sleep(30);
      same(await tooltip(page), { count: 0 }, "after focus leaves");
    },
  });
}

const iconsAfterLoads = async (page, category) => {
  const results = [];
  for (let load = 0; load < 3; load += 1) {
    await page.goto("inventory.html", 150);
    results.push(await page.eval((name) => ({
      stored: JSON.parse(localStorage.getItem("miniMartCategoryIcons"))[name],
      id: window.miniMartDB.categoryIconId(name),
      path: window.miniMartDB.categoryIcon?.(name) ?? categoryIconPath(name),
    }), category));
  }
  return results;
};

tests.push({
  name: "old icon ids and paths move to the right PNG and stay there after two reloads",
  run: async ({ page, server }) => {
    for (const [legacy, expectedId] of Object.entries(LEGACY)) {
      await page.seed({ miniMartCategories: ["Old"], miniMartCategoryIcons: { Old: legacy } });
      const expected = { stored: expectedId, id: expectedId, path: ALLOWED[expectedId][0] };
      same(await iconsAfterLoads(page, "Old"), [expected, expected, expected], legacy);
    }
    noFailedRequests(server);
  },
});

tests.push({
  name: "current icon ids and their paths are stable",
  run: async ({ page }) => {
    for (const [id, [iconPath]] of Object.entries(ALLOWED)) {
      for (const stored of [id, iconPath]) {
        await page.seed({ miniMartCategories: ["Current"], miniMartCategoryIcons: { Current: stored } });
        const expected = { stored: id, id, path: iconPath };
        same((await iconsAfterLoads(page, "Current")).slice(-1), [expected], stored);
      }
    }
  },
});

for (const value of TAMPERED) {
  tests.push({
    name: `a tampered icon value falls back and injects nothing: ${JSON.stringify(value)}`,
    run: async ({ page, server }) => {
      await page.seed({ miniMartCategories: ["Tampered"], miniMartCategoryIcons: { Tampered: value } });
      await page.goto("inventory.html");
      await page.goto("inventory.html");
      const state = await page.eval(() => ({
        stored: JSON.parse(localStorage.getItem("miniMartCategoryIcons")).Tampered,
        id: window.miniMartDB.categoryIconId("Tampered"),
        pwned: window.__pwned ?? null,
        scripts: document.querySelectorAll("#inventoryTable script, tbody script").length,
        broken: [...document.images].filter((image) => image.getAttribute("src") && image.complete && !image.naturalWidth).map((image) => image.getAttribute("src")),
      }));
      same(state, { stored: "bread", id: "bread", pwned: null, scripts: 0, broken: [] }, "state");
      noFailedRequests(server);
    },
  });
}

for (const [name, file] of [["Inventory", "inventory"], ["Settings", "settings"], ["Checkout", "index"]]) {
  tests.push({
    name: `${name} shows category icons with no broken images`,
    run: async ({ page, server }) => {
      await page.seed();
      await page.goto(`${file}.html`, 600);
      same(await page.eval("[...document.images].filter(i=>i.getAttribute('src')&&i.complete&&!i.naturalWidth).map(i=>i.getAttribute('src'))"), [], "broken images");
      noFailedRequests(server);
    },
  });
}

const openManageCategories = async (page, size) => {
  await page.send("Emulation.setDeviceMetricsOverride", { ...size, deviceScaleFactor: 1, mobile: false });
  await page.seed();
  await page.goto("settings.html");
  await page.eval("document.getElementById('openCategoryManagement').click()");
  await page.until("document.querySelectorAll('.category-management-row').length>0", { label: "the category list" });
};

for (const size of [{ width: 1366, height: 650 }, { width: 1264, height: 805 }, { width: 1920, height: 1040 }]) {
  tests.push({
    name: `Manage categories: every Edit category opens with a mouse click at ${size.width}x${size.height}`,
    run: async ({ page }) => {
      await openManageCategories(page, size);
      const rows = await page.eval("document.querySelectorAll('.category-management-row').length");
      const unreachable = [];
      for (let index = 0; index < rows; index += 1) {
        await page.click(".category-management-edit-panel > summary", index);
        await sleep(60);
        const opened = await page.eval((position) => document.querySelectorAll(".category-management-edit-panel")[position].open, index);
        if (!opened) unreachable.push(index + 1);
      }
      same(unreachable, [], `rows out of ${rows} that a click could not open`);
    },
  });
}

tests.push({
  name: "Manage categories: the empty message is hidden while categories are listed",
  run: async ({ page }) => {
    await openManageCategories(page, { width: 1264, height: 805 });
    same(await page.eval("getComputedStyle(document.getElementById('categoryManagementEmpty')).display"), "none", "display");
  },
});

module.exports = { tests };
