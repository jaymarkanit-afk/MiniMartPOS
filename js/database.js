const PRODUCTS_KEY = "miniMartProducts";
const SALES_KEY = "miniMartSales";
const CATEGORIES_KEY = "miniMartCategories";
const CATEGORY_ICONS_KEY = "miniMartCategoryIcons";
const DELETED_PRODUCTS_KEY = "miniMartDeletedProducts";
const CATEGORY_UNITS_KEY = "miniMartCategoryUnits";
const CATEGORY_ICON_ALLOWLIST = Object.freeze({
  amenities: { path: "Icons/amenities.png", label: "Amenities" },
  beverages: { path: "Icons/beverages.png", label: "Beverages" },
  bread: { path: "Icons/bread.png", label: "Bread" },
  cannedFood: { path: "Icons/canned-food.png", label: "Canned Food" },
  cigarette: { path: "Icons/cigarette.png", label: "Cigarettes" },
  dairy: { path: "Icons/dairy.png", label: "Dairy" },
  detergent: { path: "Icons/detergent.png", label: "Household & Cleaning" },
  frozenGoods: { path: "Icons/frozengoods.png", label: "Frozen Goods" },
  instantFood: { path: "Icons/instant-food.png", label: "Instant Food" },
  riceGrains: { path: "Icons/rice&grains.png", label: "Rice & Grains" },
  sauces: { path: "Icons/sauces.png", label: "Sauces & Oils" },
  schoolSupplies: { path: "Icons/school_supplies.png", label: "School Supplies" },
  snacks: { path: "Icons/snacks.png", label: "Snacks" },
  sweets: { path: "Icons/sweets.png", label: "Sweets" },
});
const CATEGORY_ICON_LEGACY_ALIASES = Object.freeze({
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
  "toiletries": "amenities",
  "Icons/toiletries.svg": "amenities",
  groceryStore: "cannedFood",
  "Icons/grocery-store.png": "cannedFood",
  vegetables: "cannedFood",
  "Icons/vegetables.svg": "cannedFood",
});
const DEFAULT_CATEGORY_ICON_ID = "bread";
const CATEGORY_ICON_PATH_TO_ID = Object.freeze(
  Object.fromEntries(
    Object.entries(CATEGORY_ICON_ALLOWLIST).map(([id, icon]) => [icon.path, id]),
  ),
);
const STORAGE_BACKUP_LIMIT = 3;
const storageIssues = [];

const UNIT_RULES = {
  piece: { label: "piece", shortLabel: "pc", decimals: 0 },
  kg: { label: "kilogram", shortLabel: "kg", decimals: 3 },
  g: { label: "gram", shortLabel: "g", decimals: 0 },
  L: { label: "liter", shortLabel: "L", decimals: 3 },
  mL: { label: "milliliter", shortLabel: "mL", decimals: 0 },
  pack: { label: "pack", shortLabel: "pack", decimals: 0 },
};

const seedProducts = [
  {
    name: "Coke 1.5L",
    category: "Beverages",
    costPrice: 52,
    price: 65,
    stock: 23,
    icon: "▣",
    accent: "var(--blue)",
  },
  {
    name: "Sprite 1.5L",
    category: "Beverages",
    costPrice: 52,
    price: 65,
    stock: 18,
    icon: "▣",
    accent: "var(--blue)",
  },
  {
    name: "Nature's Spring 500ml",
    category: "Beverages",
    costPrice: 8,
    price: 12,
    stock: 35,
    icon: "▣",
    accent: "var(--blue)",
  },
  {
    name: "Nestea Lemon 1L",
    category: "Beverages",
    costPrice: 45,
    price: 58,
    stock: 16,
    icon: "▣",
    accent: "var(--blue)",
  },
  {
    name: "Lucky Me Pancit Canton",
    category: "Instant Food",
    costPrice: 11,
    price: 15,
    stock: 50,
    icon: "⌁",
    accent: "var(--red)",
  },
  {
    name: "Lucky Me Chicken Noodles",
    category: "Instant Food",
    costPrice: 10,
    price: 14,
    stock: 42,
    icon: "⌁",
    accent: "var(--red)",
  },
  {
    name: "Payless Xtra Big",
    category: "Instant Food",
    costPrice: 13,
    price: 18,
    stock: 28,
    icon: "⌁",
    accent: "var(--red)",
  },
  {
    name: "Nissin Cup Noodles",
    category: "Instant Food",
    costPrice: 24,
    price: 32,
    stock: 20,
    icon: "⌁",
    accent: "var(--red)",
  },
  {
    name: "Piattos 40g",
    category: "Snacks",
    costPrice: 16,
    price: 22,
    stock: 29,
    icon: "◉",
    accent: "var(--gold)",
  },
  {
    name: "Chippy Barbecue 110g",
    category: "Snacks",
    costPrice: 13,
    price: 18,
    stock: 34,
    icon: "◉",
    accent: "var(--gold)",
  },
  {
    name: "Choc Nut 24g",
    category: "Snacks",
    costPrice: 7,
    price: 10,
    stock: 45,
    icon: "◉",
    accent: "var(--gold)",
  },
  {
    name: "Nova Country 78g",
    category: "Snacks",
    costPrice: 21,
    price: 28,
    stock: 25,
    icon: "◉",
    accent: "var(--gold)",
  },
  {
    name: "Bear Brand 33g",
    category: "Dairy",
    costPrice: 10,
    price: 14,
    stock: 40,
    icon: "♙",
    accent: "var(--green)",
  },
  {
    name: "Alaska Fortified Milk 1L",
    category: "Dairy",
    costPrice: 78,
    price: 92,
    stock: 14,
    icon: "♙",
    accent: "var(--green)",
  },
  {
    name: "Selecta Ice Cream Cup",
    category: "Dairy",
    costPrice: 26,
    price: 35,
    stock: 22,
    icon: "♙",
    accent: "var(--green)",
  },
  {
    name: "Yakult 5-Pack",
    category: "Dairy",
    costPrice: 38,
    price: 48,
    stock: 19,
    icon: "♙",
    accent: "var(--green)",
  },
  {
    name: "Skyflakes Crackers",
    category: "Snacks",
    costPrice: 6,
    price: 8,
    stock: 60,
    icon: "◉",
    accent: "var(--gold)",
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isKnownCost(value) {
  if (value === null || value === undefined || value === "") return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0;
}

function normalizeUnit(value) {
  return Object.prototype.hasOwnProperty.call(UNIT_RULES, value) ? value : "piece";
}

function unitDecimals(unit) {
  return UNIT_RULES[normalizeUnit(unit)].decimals;
}

function roundQuantity(value, unit = "piece") {
  const decimals = unitDecimals(unit);
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatQuantity(value, unit = "piece") {
  const normalizedUnit = normalizeUnit(unit);
  const amount = roundQuantity(value, normalizedUnit);
  const formatted = amount
    .toFixed(unitDecimals(normalizedUnit))
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
  return `${formatted} ${UNIT_RULES[normalizedUnit].shortLabel}`;
}

function isValidStoredValue(key, value, fallback) {
  if (Array.isArray(fallback)) {
    if (!Array.isArray(value)) return false;
    if (key === PRODUCTS_KEY || key === SALES_KEY) {
      return value.every((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
    }
    return true;
  }
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function backupCorruptValue(key, raw) {
  if (typeof raw !== "string") return;
  const backupKey = `${key}__corrupt_${Date.now()}`;
  try {
    const result = safeWrite(backupKey, raw, { raw: true });
    if (!result.ok) {
      showStorageError(storageErrorMessage(result));
      throw result.error;
    }
    const backups = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const candidate = localStorage.key(index);
      if (candidate?.startsWith(`${key}__corrupt_`)) backups.push(candidate);
    }
    backups
      .sort((first, second) => Number(second.slice(`${key}__corrupt_`.length)) - Number(first.slice(`${key}__corrupt_`.length)))
      .slice(STORAGE_BACKUP_LIMIT)
      .forEach((oldKey) => localStorage.removeItem(oldKey));
  } catch (error) {
    console.error(`Could not back up unreadable storage key "${key}".`, error);
  }
}

function reportStorageIssue(key, status, error = null) {
  const issue = { key, status, timestamp: new Date().toISOString() };
  if (!storageIssues.some((entry) => entry.key === key && entry.status === status)) {
    storageIssues.push(issue);
  }
  console.error(
    `Mini Mart storage ${status} for "${key}". Using a fallback without overwriting the original.`,
    error || "",
  );
  window.dispatchEvent(new CustomEvent("storage-corrupt", { detail: issue }));
}

function read(key, fallback, validator = null) {
  let saved;
  try {
    saved = localStorage.getItem(key);
  } catch (error) {
    reportStorageIssue(key, "corrupt", error);
    return { status: "corrupt", value: clone(fallback), error, raw: null };
  }
  if (saved === null) return { status: "missing", value: clone(fallback), error: null, raw: null };
  try {
    const value = JSON.parse(saved);
    if (!isValidStoredValue(key, value, fallback) || (validator && !validator(value))) {
      backupCorruptValue(key, saved);
      const error = new Error("Stored value has the wrong shape.");
      reportStorageIssue(key, "invalid", error);
      return { status: "invalid", value: clone(fallback), error, raw: saved };
    }
    return { status: "ok", value, error: null, raw: saved };
  } catch (error) {
    backupCorruptValue(key, saved);
    reportStorageIssue(key, "corrupt", error);
    return { status: "corrupt", value: clone(fallback), error, raw: saved };
  }
}

function normalizeCategoryIcons(icons) {
  const normalized = {};
  Object.entries(icons && typeof icons === "object" ? icons : {}).forEach(
    ([category, storedIcon]) => {
      const iconId = Object.prototype.hasOwnProperty.call(
        CATEGORY_ICON_ALLOWLIST,
        storedIcon,
      )
        ? storedIcon
        : CATEGORY_ICON_LEGACY_ALIASES[storedIcon] ||
          CATEGORY_ICON_PATH_TO_ID[storedIcon] ||
          DEFAULT_CATEGORY_ICON_ID;
      normalized[category] = iconId;
    },
  );
  return normalized;
}

function migrateCategoryIcons() {
  const result = read(CATEGORY_ICONS_KEY, {});
  if (result.status === "missing") return {};
  const migrated = normalizeCategoryIcons(result.value);
  const changed = JSON.stringify(migrated) !== JSON.stringify(result.value);
  if (changed) write(CATEGORY_ICONS_KEY, migrated);
  return migrated;
}

function write(key, value) {
  const result = safeWrite(key, value);
  if (!result.ok) {
    showStorageError(storageErrorMessage(result));
    return result;
  }

  window.dispatchEvent(
    new CustomEvent("miniMartDatabaseChanged", { detail: { key } }),
  );
  return result;
}

function normalizeProducts(products) {
  const existingNames = new Set(products.map((product) => product.name));
  const missingProducts = seedProducts.filter(
    (product) => !existingNames.has(product.name),
  );
  return [...products, ...missingProducts].map((product) => {
    const seed =
      seedProducts.find((entry) => entry.name === product.name) || {};
    return {
      ...seed,
      ...product,
      id: product.id || `product-${String(product.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      category: product.category || seed.category || "Snacks",
      icon: product.icon || seed.icon || "◇",
      accent: product.accent || seed.accent || "var(--gold)",
      unit: normalizeUnit(product.unit || seed.unit),
      costPrice: isKnownCost(product.costPrice)
        ? Number(product.costPrice)
        : isKnownCost(seed.costPrice)
          ? Number(seed.costPrice)
          : null,
    };
  });
}

window.miniMartDB = {
  readStorage(key, fallback, validator = null) {
    return read(key, fallback, validator);
  },
  isKnownCost,
  units: () => UNIT_RULES,
  normalizeUnit,
  unitDecimals,
  roundQuantity,
  roundMoney,
  formatQuantity,
  categories() {
    const result = read(
      CATEGORIES_KEY,
      [...new Set(seedProducts.map((product) => product.category))],
    );
    if (result.status === "missing") {
      write(CATEGORIES_KEY, result.value);
    }
    return result.value;
  },
  saveCategories(categories) {
    return write(CATEGORIES_KEY, [...new Set(categories)]);
  },
  categoryDefaultUnit(category) {
    const units = read(CATEGORY_UNITS_KEY, {}).value;
    return normalizeUnit(units[category]);
  },
  saveCategoryDefaultUnit(category, unit) {
    const units = read(CATEGORY_UNITS_KEY, {}).value;
    units[category] = normalizeUnit(unit);
    return write(CATEGORY_UNITS_KEY, units);
  },
  renameCategory(oldName, newName) {
    const categories = this.categories();
    const products = this.products().map((product) =>
      product.category === oldName ? { ...product, category: newName } : product,
    );
    const renamed = categories.map((category) =>
      category === oldName ? newName : category,
    );
    const icons = migrateCategoryIcons();
    const units = read(CATEGORY_UNITS_KEY, {}).value;
    if (icons[oldName] && !icons[newName]) icons[newName] = icons[oldName];
    delete icons[oldName];
    if (units[oldName] !== undefined && units[newName] === undefined)
      units[newName] = units[oldName];
    delete units[oldName];
    write(CATEGORIES_KEY, renamed);
    write(PRODUCTS_KEY, products);
    write(CATEGORY_ICONS_KEY, icons);
    write(CATEGORY_UNITS_KEY, units);
  },
  moveCategory(category, direction) {
    const categories = this.categories();
    const index = categories.indexOf(category);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= categories.length) return;
    [categories[index], categories[nextIndex]] = [
      categories[nextIndex],
      categories[index],
    ];
    write(CATEGORIES_KEY, categories);
  },
  deleteCategory(category, moveTo = "") {
    const products = this.products();
    const hasProducts = products.some((product) => product.category === category);
    if (hasProducts && !moveTo) {
      return { error: new Error("A destination category is required.") };
    }
    if (hasProducts && !this.categories().includes(moveTo)) {
      return { error: new Error("The destination category does not exist.") };
    }
    if (hasProducts) {
      this.saveProducts(
        products.map((product) =>
          product.category === category
            ? { ...product, category: moveTo }
            : product,
        ),
      );
    }
    const icons = read(CATEGORY_ICONS_KEY, {}).value;
    const units = read(CATEGORY_UNITS_KEY, {}).value;
    delete icons[category];
    delete units[category];
    write(CATEGORIES_KEY, this.categories().filter((entry) => entry !== category));
    write(CATEGORY_ICONS_KEY, icons);
    write(CATEGORY_UNITS_KEY, units);
    return { error: null };
  },
  categoryIcon(category) {
    const defaults = {
      Beverages: "beverages",
      "Instant Food": "instantFood",
      Snacks: "snacks",
      Dairy: "dairy",
      Bakery: DEFAULT_CATEGORY_ICON_ID,
    };
    const saved = migrateCategoryIcons();
    const iconId = Object.prototype.hasOwnProperty.call(
      CATEGORY_ICON_ALLOWLIST,
      saved[category],
    )
      ? saved[category]
      : defaults[category] || DEFAULT_CATEGORY_ICON_ID;
    return (
      CATEGORY_ICON_ALLOWLIST[iconId]?.path ||
      CATEGORY_ICON_ALLOWLIST[DEFAULT_CATEGORY_ICON_ID].path
    );
  },
  saveCategoryIcon(category, iconId) {
    const icons = migrateCategoryIcons();
    icons[category] = Object.prototype.hasOwnProperty.call(
      CATEGORY_ICON_ALLOWLIST,
      iconId,
    )
      ? iconId
      : DEFAULT_CATEGORY_ICON_ID;
    return write(CATEGORY_ICONS_KEY, icons);
  },
  categoryIconId(category) {
    const icons = migrateCategoryIcons();
    const iconId = icons[category];
    return Object.prototype.hasOwnProperty.call(CATEGORY_ICON_ALLOWLIST, iconId)
      ? iconId
      : DEFAULT_CATEGORY_ICON_ID;
  },
  categoryIconOptions() {
    return Object.entries(CATEGORY_ICON_ALLOWLIST).map(([id, icon]) => ({
      id,
      path: icon.path,
      label: icon.label,
    }));
  },
  normalizeCategoryIcons,
  products() {
    const productsResult = read(PRODUCTS_KEY, seedProducts);
    if (productsResult.status === "missing") write(PRODUCTS_KEY, seedProducts);
    const deletedNamesResult = read(DELETED_PRODUCTS_KEY, []);
    const deletedNames = new Set(deletedNamesResult.value);
    const products = normalizeProducts(productsResult.value).filter(
      (product) => !deletedNames.has(product.name),
    );
    if (productsResult.status === "ok" || productsResult.status === "missing") {
      const result = safeWrite(PRODUCTS_KEY, products);
      if (!result.ok) showStorageError(storageErrorMessage(result));
    }
    return products;
  },
  saveProducts(products) {
    const names = new Set(products.map((product) => product.name));
    const deletedNames = new Set(read(DELETED_PRODUCTS_KEY, []).value);
    seedProducts.forEach((product) => {
      if (names.has(product.name)) deletedNames.delete(product.name);
      else deletedNames.add(product.name);
    });
    const deletedResult = write(DELETED_PRODUCTS_KEY, [...deletedNames]);
    if (!deletedResult.ok) return deletedResult;
    return write(PRODUCTS_KEY, products);
  },
  sales() {
    return read(SALES_KEY, []).value;
  },
  saveSales(sales) {
    return write(SALES_KEY, clone(sales));
  },
  recordSale(items, total, payment = {}) {
    const sales = this.sales();
    sales.push({
      id: payment.transactionNumber || crypto.randomUUID(),
      date: new Date().toISOString(),
      items: clone(items),
      total,
      transactionNumber: payment.transactionNumber || null,
      paymentMethod: payment.paymentMethod || "cash",
      payments: clone(payment.payments || {}),
      shiftId: payment.shiftId || null,
      status: payment.status || "completed",
      cashGiven: Number.isFinite(Number(payment.cashGiven))
        ? Number(payment.cashGiven)
        : null,
      cashRequired: Number.isFinite(Number(payment.cashRequired))
        ? Number(payment.cashRequired)
        : null,
      change: Number.isFinite(Number(payment.change))
        ? Number(payment.change)
        : null,
      rewardUsed: Number.isFinite(Number(payment.rewardUsed))
        ? Number(payment.rewardUsed)
        : null,
    });
    return write(SALES_KEY, sales);
  },
  getStorageIssues() {
    return storageIssues.map((issue) => ({ ...issue }));
  },
};
