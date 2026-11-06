"use strict";
// The in-app dialog, driven by a real mouse and keyboard.
const { BLOCKED_HOSTS } = require("../lib/chrome");
const { sleep } = require("../lib/cdp");

const SIZES = [
  { width: 1366, height: 650 },
  { width: 1264, height: 805 },
  { width: 1920, height: 1040 },
  { width: 390, height: 844 },
];
const DIALOG = ".confirm-dialog";
const CANCEL = ".confirm-dialog-button.is-cancel";
const ACTION = ".confirm-dialog-button.is-confirm";
const BACKDROP = ".confirm-dialog-backdrop";
const STORE_NAME = "My Corner Store";
const SECTIONS = {
  store: {
    button: "#resetStoreInfo",
    title: "Reset Store Info to defaults?",
    message: "The store name, address, contact number, register name, receipt footer, timezone, date format and logo go back to their defaults.",
    details: "Products, sales and customers are not touched.",
    settings: { storeName: STORE_NAME },
    changed: (settings) => settings.storeName !== STORE_NAME,
  },
  inventory: {
    button: "#resetInventoryRules",
    title: "Reset Inventory Rules to defaults?",
    message: "The low-stock threshold and the out-of-stock sales rule go back to their defaults.",
    details: "Products, stock and sales are not touched.",
    settings: { lowStockThreshold: 3 },
    changed: (settings) => settings.lowStockThreshold === 10,
  },
  suki: {
    button: "#resetSukiSettings",
    title: "Reset Suki Rewards to defaults?",
    message: "Suki on or off, pesos per point, peso value, the redeem minimum and point expiry go back to their defaults.",
    details: "Customers and their stored points are not touched, but what a point is worth and whether points expire will follow the defaults.",
    settings: { sukiPesosPerPoint: 50 },
    changed: (settings) => settings.sukiPesosPerPoint === 20,
  },
};
const expect = (actual, expected, label) => {
  const [a, b] = [JSON.stringify(actual), JSON.stringify(expected)];
  if (a !== b) throw new Error(`${label}: expected ${b}, got ${a}`.slice(0, 500));
};
const settingsNow = (page) => page.eval("JSON.parse(localStorage.getItem('miniMartSettings')||'{}')");
const dialogCount = (page) => page.eval((selector) => document.querySelectorAll(selector).length, DIALOG);
const openSettings = async (page, storage = {}, size = null) => {
  if (size) await page.send("Emulation.setDeviceMetricsOverride", { ...size, deviceScaleFactor: 1, mobile: false });
  await page.seed(storage);
  await page.goto("settings.html");
};
const openReset = async (page, section = "store", { size = null, theme = null } = {}) => {
  const { button, settings } = SECTIONS[section];
  await openSettings(page, { miniMartSettings: { ...settings, ...(theme ? { theme } : {}) } }, size);
  await page.eval((target) => {
    const panel = document.querySelector(target).closest("[role='tabpanel']");
    document.querySelector(`.settings-tab[data-settings-panel="${panel.id}"]`)?.click();
  }, button);
  await page.click(button);
  await page.until(`document.querySelector("${DIALOG}")`, { label: "the dialog" });
};
const expectUnchanged = async (page, section = "store") => {
  await sleep(40);
  expect(await dialogCount(page), 0, "dialogs open");
  expect(SECTIONS[section].changed(await settingsNow(page)), false, "section changed");
};
const focusedClass = (page) => page.eval("document.activeElement.className");
const noProblems = (page) => {
  const problems = page.problems.filter((problem) => !BLOCKED_HOSTS.some((host) => `${problem.text} ${problem.url || ""}`.includes(host)));
  if (problems.length) throw new Error(problems.map(({ kind, text }) => `${kind}: ${text}`).join(" | ").slice(0, 400));
};
const contrast = (page, selector, backgroundSelector = DIALOG) => page.eval((target, backgroundTarget) => {
  const parse = (color) => color.match(/[\d.]+/g).map(Number);
  const luminance = (rgb) => {
    const [r, g, b] = rgb.slice(0, 3).map((value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const text = parse(getComputedStyle(document.querySelector(target)).color);
  const background = parse(getComputedStyle(document.querySelector(backgroundTarget)).backgroundColor);
  const [light, dark] = [luminance(text), luminance(background)].sort((a, b) => b - a);
  return { ratio: (light + 0.05) / (dark + 0.05), alpha: background[3] ?? 1 };
}, selector, backgroundSelector);

const tests = [];

for (const [section, { title, message, details }] of Object.entries(SECTIONS)) {
  tests.push({
    name: `the ${section} reset shows the right title and message`,
    run: async ({ page }) => {
      await openReset(page, section);
      const state = await page.eval((selector) => {
        const card = document.querySelector(selector);
        const body = document.getElementById(card.getAttribute("aria-describedby"));
        return {
          role: card.getAttribute("role"),
          modal: card.getAttribute("aria-modal"),
          title: document.getElementById(card.getAttribute("aria-labelledby")).textContent,
          text: [...body.querySelectorAll("p")].map((line) => line.textContent),
          buttons: [...card.querySelectorAll("button")].map((button) => button.textContent),
          icon: Boolean(card.querySelector(".confirm-dialog-icon")),
        };
      }, DIALOG);
      expect(state, {
        role: "alertdialog", modal: "true", title, text: [message, details], buttons: ["Keep my settings", "Reset section"], icon: true,
      }, "dialog");
    },
  });
  tests.push({
    name: `the action button resets the ${section} section`,
    run: async ({ page }) => {
      await openReset(page, section);
      await page.click(ACTION);
      await sleep(60);
      expect(await dialogCount(page), 0, "dialogs open");
      expect(SECTIONS[section].changed(await settingsNow(page)), true, "section reset");
    },
  });
}

tests.push({
  name: "the reset changes only that section",
  run: async ({ page }) => {
    await openSettings(page, { miniMartSettings: { storeName: STORE_NAME, lowStockThreshold: 3 } });
    await page.click(SECTIONS.store.button);
    await page.until(`document.querySelector("${DIALOG}")`, { label: "the dialog" });
    await page.click(ACTION);
    await sleep(60);
    expect((await settingsNow(page)).lowStockThreshold, 3, "other section");
  },
});

tests.push({
  name: "Cancel leaves the section unchanged",
  run: async ({ page }) => {
    await openReset(page);
    await page.click(CANCEL);
    await expectUnchanged(page);
  },
});

tests.push({
  name: "Escape leaves the section unchanged",
  run: async ({ page }) => {
    await openReset(page);
    await page.pressKey("Escape");
    await expectUnchanged(page);
  },
});

tests.push({
  name: "a backdrop click leaves the section unchanged",
  run: async ({ page }) => {
    await openReset(page);
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 8, y: 8 });
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 8, y: 8, button: "left", clickCount: 1 });
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 8, y: 8, button: "left", clickCount: 1 });
    await expectUnchanged(page);
  },
});

tests.push({
  name: "a click on the card itself does not close it",
  run: async ({ page }) => {
    await openReset(page);
    await page.click(`${DIALOG} h2`);
    await sleep(40);
    expect(await dialogCount(page), 1, "dialogs open");
  },
});

tests.push({
  name: "Enter activates only the focused button",
  run: async ({ page }) => {
    await openReset(page);
    await page.pressKey("Enter");
    await expectUnchanged(page);
    await page.click(SECTIONS.store.button);
    await page.until(`document.querySelector("${DIALOG}")`, { label: "the dialog" });
    await page.pressKey("Tab");
    await page.pressKey("Enter");
    await sleep(60);
    expect(SECTIONS.store.changed(await settingsNow(page)), true, "section reset");
  },
});

tests.push({
  name: "a danger dialog starts on the safe button",
  run: async ({ page }) => {
    await openReset(page);
    expect((await focusedClass(page)).includes("is-cancel"), true, "focus on Cancel");
  },
});

tests.push({
  name: "a normal dialog starts on the action button",
  run: async ({ page }) => {
    await openSettings(page);
    await page.eval("void confirmDialog({title:'Check',message:'Sure?',confirmLabel:'Yes, add it',cancelLabel:'Go back'})");
    expect((await focusedClass(page)).includes("is-confirm"), true, "focus on the action");
    expect(await page.eval("Boolean(document.querySelector('.confirm-dialog-icon'))"), false, "warning icon");
  },
});

tests.push({
  name: "Tab and Shift+Tab stay inside the dialog",
  run: async ({ page }) => {
    await openReset(page);
    const stops = [];
    for (let press = 0; press < 3; press += 1) {
      await page.pressKey("Tab");
      stops.push(await focusedClass(page));
    }
    await page.pressKey("Tab", { shift: true });
    stops.push(await focusedClass(page));
    await page.pressKey("Tab", { shift: true });
    stops.push(await focusedClass(page));
    expect(stops.map((name) => (name.includes("is-confirm") ? "action" : name.includes("is-cancel") ? "cancel" : name)),
      ["action", "cancel", "action", "cancel", "action"], "focus order");
  },
});

tests.push({
  name: "focus returns to the button that opened it",
  run: async ({ page }) => {
    await openReset(page);
    await page.click(CANCEL);
    await sleep(40);
    expect(await page.eval("document.activeElement.id"), "resetStoreInfo", "focused element");
  },
});

tests.push({
  name: "page scroll is locked while open and released after",
  run: async ({ page }) => {
    await openSettings(page, { miniMartSettings: { storeName: STORE_NAME } });
    await page.eval("document.body.style.overflow='scroll'");
    await page.click(SECTIONS.store.button);
    await page.until(`document.querySelector("${DIALOG}")`, { label: "the dialog" });
    expect(await page.eval("document.body.style.overflow"), "hidden", "while open");
    await page.click(CANCEL);
    await sleep(40);
    expect(await page.eval("document.body.style.overflow"), "scroll", "after closing");
  },
});

tests.push({
  name: "a second dialog does not stack",
  run: async ({ page }) => {
    await openReset(page);
    const second = await page.eval("confirmDialog({title:'Second',message:'No',confirmLabel:'Yes'})");
    expect(second, false, "second call");
    expect(await dialogCount(page), 1, "dialogs open");
    expect(await page.eval(`document.querySelector("${DIALOG} h2").textContent`), SECTIONS.store.title, "first dialog kept");
    await page.click(CANCEL);
    await expectUnchanged(page);
    await page.eval("void confirmDialog({title:'Third',message:'Yes',confirmLabel:'Yes'})");
    expect(await dialogCount(page), 1, "a new dialog can open after");
  },
});

tests.push({
  name: "an error while opening leaves the page usable",
  run: async ({ page }) => {
    await openSettings(page);
    const result = await page.eval(async () => {
      const append = document.body.append;
      document.body.append = () => { throw new Error("test failure"); };
      const answer = await Promise.race([
        confirmDialog({ title: "Broken", message: "No", confirmLabel: "Yes" }),
        new Promise((resolve) => { setTimeout(() => resolve("stuck"), 500); }),
      ]);
      document.body.append = append;
      return { answer, overflow: document.body.style.overflow, open: document.querySelectorAll(".confirm-dialog-backdrop").length };
    });
    expect(result, { answer: false, overflow: "", open: 0 }, "after the error");
    page.problems.length = 0;
    await page.eval("void confirmDialog({title:'Works',message:'Yes',confirmLabel:'Yes'})");
    expect(await dialogCount(page), 1, "a new dialog can open after");
  },
});

tests.push({
  name: "the message is shown as text, so nothing can be injected",
  run: async ({ page }) => {
    await openSettings(page);
    await page.eval(`void confirmDialog({title:'<img src=x onerror="window.__pwned=1">',message:'<b>bold</b>',confirmLabel:'Yes'})`);
    await sleep(40);
    expect(await page.eval(`[window.__pwned??null,document.querySelectorAll('${DIALOG} img,${DIALOG} b').length]`), [null, 0], "injected");
  },
});

for (const size of SIZES) {
  tests.push({
    name: `the dialog fits and is clickable at ${size.width}x${size.height}`,
    run: async ({ page }) => {
      await openReset(page, "suki", { size });
      const fit = await page.eval((selectors) => {
        const [card, cancel, action] = selectors.map((selector) => document.querySelector(selector));
        const rect = card.getBoundingClientRect();
        const reachable = (button) => {
          const box = button.getBoundingClientRect();
          return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) === button;
        };
        return {
          inside: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
          cancel: reachable(cancel),
          action: reachable(action),
          sideways: document.documentElement.scrollWidth > innerWidth,
        };
      }, [DIALOG, CANCEL, ACTION]);
      expect(fit, { inside: true, cancel: true, action: true, sideways: false }, "fit");
      await page.click(ACTION);
      await sleep(60);
      expect(SECTIONS.suki.changed(await settingsNow(page)), true, "section reset");
    },
  });
}

tests.push({
  name: "the buttons stack on a phone",
  run: async ({ page }) => {
    await openReset(page, "store", { size: { width: 390, height: 844 } });
    const stacked = await page.eval((selectors) => {
      const [cancel, action] = selectors.map((selector) => document.querySelector(selector).getBoundingClientRect());
      return action.bottom <= cancel.top && Math.abs(action.width - cancel.width) < 1;
    }, [CANCEL, ACTION]);
    expect(stacked, true, "stacked");
  },
});

for (const theme of ["light", "dark"]) {
  tests.push({
    name: `the dialog is readable in ${theme} mode`,
    run: async ({ page }) => {
      await openReset(page, "store", { theme });
      expect(await page.eval("document.documentElement.dataset.theme"), theme, "theme");
      for (const [selector, background] of [[`${DIALOG} h2`, DIALOG], [`${DIALOG} p`, DIALOG], [".confirm-dialog-details", DIALOG], [CANCEL, DIALOG], [ACTION, ACTION]]) {
        const { ratio, alpha } = await contrast(page, selector, background);
        if (ratio < 4.5) throw new Error(`${selector}: contrast ${ratio.toFixed(2)} is under 4.5`);
        if (alpha !== 1) throw new Error(`${background}: background is see-through`);
      }
    },
  });
}

tests.push({
  name: "there is no animation with reduced motion",
  run: async ({ page }) => {
    await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await openReset(page);
    expect(await page.eval(`getComputedStyle(document.querySelector("${BACKDROP}")).animationName`), "none", "animation");
  },
});

tests.push({
  name: "opening and closing the dialog causes no console errors",
  run: async ({ page }) => {
    await openReset(page);
    await page.click(CANCEL);
    await sleep(40);
    noProblems(page);
  },
});

const answer = async (page, selector) => {
  await page.until(`document.querySelector("${DIALOG}")`, { label: "the dialog" });
  await page.click(selector);
  await sleep(80);
};
const dialogText = (page) => page.eval((selector) => {
  const card = document.querySelector(selector);
  return {
    title: card.querySelector("h2").textContent,
    text: [...card.querySelectorAll("p")].map((line) => line.textContent),
    buttons: [...card.querySelectorAll("button")].map((button) => button.textContent),
    danger: card.classList.contains("is-danger"),
  };
}, DIALOG);
const openDialogText = async (page) => {
  await page.until(`document.querySelector("${DIALOG}")`, { label: "the dialog" });
  return dialogText(page);
};
const stored = (page, key) => page.eval((name) => JSON.parse(localStorage.getItem(name) || "null"), key);
const cartNames = (page) => page.eval("[...cart.values()].map(i=>i.name)");
const PRODUCT = { category: "Snacks", price: 10, costPrice: 5, unit: "piece", icon: "x", accent: "var(--gold)" };
const SEED_NAMES = ["Coke 1.5L", "Sprite 1.5L", "Nature's Spring 500ml", "Nestea Lemon 1L", "Lucky Me Pancit Canton", "Lucky Me Chicken Noodles", "Payless Xtra Big", "Nissin Cup Noodles", "Piattos 40g", "Chippy Barbecue 110g", "Choc Nut 24g", "Nova Country 78g", "Bear Brand 33g", "Alaska Fortified Milk 1L", "Selecta Ice Cream Cup", "Yakult 5-Pack", "Skyflakes Crackers"];
const heldCartStore = {
  miniMartHeldCarts: [{ id: "H1", createdAt: new Date().toISOString(), items: [{ productId: "b", name: "Beta", price: 10, quantity: 2, unit: "piece" }] }],
  miniMartProducts: [{ ...PRODUCT, id: "a", name: "Alpha", stock: 9 }, { ...PRODUCT, id: "b", name: "Beta", stock: 9 }],
  miniMartDeletedProducts: SEED_NAMES,
};
const openWithCart = async (page) => {
  await page.seed(heldCartStore);
  await page.goto("index.html");
  await page.eval("addProductToCart(window.miniMartDB.products()[0])");
  await page.click("#resumeCartButton");
};

tests.push({
  name: "held cart: the dialog says the current cart will be removed",
  run: async ({ page }) => {
    await openWithCart(page);
    expect(await openDialogText(page), {
      title: "Replace the current cart?",
      text: ["The held cart will take its place, and the items in the current cart will be removed.", "To keep them, hold this cart first."],
      buttons: ["Keep current cart", "Replace cart"],
      danger: true,
    }, "dialog");
  },
});

tests.push({
  name: "held cart: cancelling keeps the current cart and the held cart",
  run: async ({ page }) => {
    await openWithCart(page);
    await answer(page, CANCEL);
    expect(await cartNames(page), ["Alpha"], "cart");
    expect((await stored(page, "miniMartHeldCarts")).length, 1, "held carts");
  },
});

tests.push({
  name: "held cart: confirming replaces the current cart",
  run: async ({ page }) => {
    await openWithCart(page);
    await answer(page, ACTION);
    expect(await cartNames(page), ["Beta"], "cart");
    expect((await stored(page, "miniMartHeldCarts")).length, 0, "held carts");
  },
});

tests.push({
  name: "held cart: with an empty cart no dialog appears",
  run: async ({ page }) => {
    await page.seed(heldCartStore);
    await page.goto("index.html");
    await page.click("#resumeCartButton");
    await sleep(80);
    expect(await dialogCount(page), 0, "dialogs open");
    expect(await cartNames(page), ["Beta"], "cart");
  },
});

const openSimilarProduct = async (page) => {
  await page.seed({ miniMartProducts: [{ ...PRODUCT, id: "a", name: "Coke Zero", stock: 9 }], miniMartDeletedProducts: SEED_NAMES, miniMartCategories: ["Snacks"] });
  await page.goto("inventory.html");
  await page.eval("openProductModal('Snacks');productName.value='Coke';productCost.value='5';productPrice.value='7';productStock.value='11'");
  await page.click("#modalSaveButton");
};
const productNames = (page) => page.eval("window.miniMartDB.products().map(p=>p.name)");

tests.push({
  name: "similar product: the dialog names both products",
  run: async ({ page }) => {
    await openSimilarProduct(page);
    expect(await openDialogText(page), {
      title: 'Add "Coke" anyway?',
      text: ['It looks similar to "Coke Zero".', "Check that this is not the same product twice."],
      buttons: ["Go back", "Add anyway"],
      danger: false,
    }, "dialog");
  },
});

tests.push({
  name: "similar product: going back adds nothing and keeps the form open",
  run: async ({ page }) => {
    await openSimilarProduct(page);
    await answer(page, CANCEL);
    expect(await productNames(page), ["Coke Zero"], "products");
    expect(await page.eval("document.getElementById('categoryModal').hidden"), false, "form hidden");
  },
});

tests.push({
  name: "similar product: confirming adds it",
  run: async ({ page }) => {
    await openSimilarProduct(page);
    await answer(page, ACTION);
    expect((await productNames(page)).sort(), ["Coke", "Coke Zero"], "products");
  },
});

tests.push({
  name: "similar product: renaming an existing product says save, not add",
  run: async ({ page }) => {
    await page.seed({ miniMartProducts: [{ ...PRODUCT, id: "a", name: "Coke Zero", stock: 9 }, { ...PRODUCT, id: "b", name: "Water", stock: 9 }], miniMartDeletedProducts: SEED_NAMES });
    await page.goto("inventory.html");
    await page.eval("openModal(window.miniMartDB.products()[1]);productName.value='Coke'");
    await page.click("#modalSaveButton");
    const shown = await openDialogText(page);
    expect([shown.title, shown.buttons], ['Save "Coke" anyway?', ["Go back", "Save anyway"]], "dialog");
    await page.click(ACTION);
    await sleep(80);
    expect((await productNames(page)).sort(), ["Coke", "Coke Zero"], "products");
  },
});

const openEmptyCategory = async (page) => {
  await page.seed({ miniMartCategories: ["Empty One"] });
  await page.goto("settings.html");
  await page.eval("document.getElementById('openCategoryManagement').click()");
  await page.until("document.querySelector('.category-management-row')", { label: "the category list" });
  await page.eval(() => {
    const row = [...document.querySelectorAll(".category-management-row")].find((entry) => entry.dataset.category === "Empty One");
    row.querySelector(".category-management-edit-panel").open = true;
    row.dataset.testTarget = "true";
  });
  await page.click('[data-test-target] [data-category-action="delete"]');
};
const categoryNames = (page) => page.eval("window.miniMartDB.categories()");

tests.push({
  name: "category delete: the dialog says what will happen",
  run: async ({ page }) => {
    await openEmptyCategory(page);
    expect(await openDialogText(page), {
      title: "Delete the Empty One category?",
      text: ["It has no products, so none will be moved."],
      buttons: ["Keep category", "Delete category"],
      danger: true,
    }, "dialog");
  },
});

tests.push({
  name: "category delete: cancelling keeps the category",
  run: async ({ page }) => {
    await openEmptyCategory(page);
    await answer(page, CANCEL);
    expect((await categoryNames(page)).includes("Empty One"), true, "category kept");
  },
});

tests.push({
  name: "category delete: Escape closes the dialog but not the category list",
  run: async ({ page }) => {
    await openEmptyCategory(page);
    await page.until(`document.querySelector("${DIALOG}")`, { label: "the dialog" });
    await page.pressKey("Escape");
    await sleep(80);
    expect((await categoryNames(page)).includes("Empty One"), true, "category kept");
    expect(await page.eval("document.getElementById('categoryManagementModal').hidden"), false, "list closed");
  },
});

tests.push({
  name: "category delete: confirming deletes it",
  run: async ({ page }) => {
    await openEmptyCategory(page);
    await answer(page, ACTION);
    expect((await categoryNames(page)).includes("Empty One"), false, "category deleted");
  },
});

const openUnitChange = async (page) => {
  await page.seed({
    miniMartProducts: [{ ...PRODUCT, id: "a", name: "Alpha", stock: 9 }],
    miniMartDeletedProducts: SEED_NAMES,
    miniMartSales: [{ id: "s", date: new Date().toISOString(), items: [{ name: "Alpha", productId: "a", quantity: 1, price: 10 }], total: 10, status: "completed" }],
  });
  await page.goto("inventory.html");
  await page.eval(() => {
    openModal(window.miniMartDB.products()[0]);
    const select = document.getElementById("productUnit");
    select.value = "kg";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

tests.push({
  name: "unit alert: it has one button and the right message",
  run: async ({ page }) => {
    await openUnitChange(page);
    expect(await openDialogText(page), {
      title: "This unit can't be changed",
      text: ["This product has stock or sales history. Create a new product if you need a different unit; existing inventory cannot be converted safely."],
      buttons: ["Got it"],
      danger: false,
    }, "dialog");
  },
});

for (const [how, act] of [
  ["the button", (page) => answer(page, ACTION)],
  ["Escape", async (page) => {
    await page.until(`document.querySelector("${DIALOG}")`, { label: "the dialog" });
    await page.pressKey("Escape");
    await sleep(80);
  }],
]) {
  tests.push({
    name: `unit alert: closing it with ${how} puts the unit back`,
    run: async ({ page }) => {
      await openUnitChange(page);
      await act(page);
      expect(await dialogCount(page), 0, "dialogs open");
      expect(await page.eval("document.getElementById('productUnit').value"), "piece", "unit");
    },
  });
}

tests.push({
  name: "void notice: it shows, and the page reloads once it is closed",
  run: async ({ page }) => {
    await page.seed({
      miniMartSales: [{ id: "old1", date: new Date().toISOString(), items: [{ name: "Coke 1.5L", price: 65, quantity: 1, lineTotal: 65, category: "Beverages" }], total: 65, status: "completed", cashRequired: 65, rewardUsed: 0 }],
    });
    await page.goto("reports.html?period=all");
    await page.eval("window.prompt=()=>'APPROVE';window.__sameDocument=true;void voidSale('old1')");
    expect(await openDialogText(page), {
      title: "Customer points not changed",
      text: ["This older sale could not be matched to one customer, so customer points were not changed."],
      buttons: ["Got it"],
      danger: false,
    }, "dialog");
    const loaded = page.waitEvent("Page.loadEventFired");
    await page.click(ACTION);
    await loaded;
    await sleep(100);
    expect(await page.eval("window.__sameDocument===true"), false, "reloaded");
  },
});

tests.push({
  name: "an alert waits for an open dialog instead of being lost",
  run: async ({ page }) => {
    await openReset(page);
    await page.eval("void alertDialog({title:'Later',message:'Waits'})");
    expect(await dialogCount(page), 1, "dialogs open");
    await page.click(CANCEL);
    await page.until(`document.querySelector("${DIALOG} h2")?.textContent==='Later'`, { label: "the alert" });
    expect(await dialogCount(page), 1, "dialogs open");
  },
});

module.exports = { tests };
