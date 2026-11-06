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
const STOCK_HISTORY_KEY = "miniMartInventoryAdjustments";
const STOCK_HISTORY_EXPORT_KEY = "miniMartStockHistoryExport";
const STOCK_HISTORY_LIMIT = 1000;
const STOCK_HISTORY_WARNING_AT = 900;
const DATA_VERSION_KEY = "miniMartDataVersion";
const DATA_VERSION = 2;
const STORAGE_BACKUP_LIMIT = 3;
const LARGE_BACKUP_CHARS = 500 * 1024;
// Free space a corruption backup must leave, so it cannot crowd out later sales.
const BACKUP_HEADROOM_CHARS = 1000 * 1000;
const BACKUP_HEADROOM_PROBE_KEY = "miniMartBackupHeadroomProbe";
const CORRUPT_KEY_MARKER = "__corrupt_";
// Shapes come from the key, never from a caller's fallback value.
const STORED_SHAPES = Object.freeze({
  [PRODUCTS_KEY]: "records",
  [SALES_KEY]: "records",
  [CATEGORIES_KEY]: "array",
  [CATEGORY_ICONS_KEY]: "object",
  [CATEGORY_UNITS_KEY]: "object",
  [DELETED_PRODUCTS_KEY]: "array",
  miniMartSukis: "array",
  miniMartCurrentShift: "object",
  miniMartShiftHistory: "array",
  miniMartHeldCarts: "array",
  miniMartFavoriteProducts: "array",
  miniMartRecentProducts: "array",
  [STOCK_HISTORY_KEY]: "records",
});
const storageIssues = [];
const backupOutcomes = new Map();

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

function formatQuantity(value, unit = "piece") {
  const normalizedUnit = normalizeUnit(unit);
  const amount = roundQuantity(value, normalizedUnit);
  const formatted = amount
    .toFixed(unitDecimals(normalizedUnit))
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
  return `${formatted} ${UNIT_RULES[normalizedUnit].shortLabel}`;
}

function matchesStoredShape(value, shape) {
  if (shape === "records") {
    return Array.isArray(value) &&
      value.every((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
  }
  if (shape === "array") return Array.isArray(value);
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidStoredValue(key, value, fallback) {
  const shape = STORED_SHAPES[key] || (Array.isArray(fallback) ? "array" : "object");
  return matchesStoredShape(value, shape);
}

function corruptBackupKeys(key) {
  const prefix = `${key}${CORRUPT_KEY_MARKER}`;
  const backups = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const candidate = localStorage.key(index);
    if (candidate?.startsWith(prefix)) backups.push(candidate);
  }
  return backups.sort(
    (first, second) => Number(second.slice(prefix.length)) - Number(first.slice(prefix.length)),
  );
}

function hasBackupHeadroom() {
  const probe = safeWrite(BACKUP_HEADROOM_PROBE_KEY, "x".repeat(BACKUP_HEADROOM_CHARS), { raw: true });
  safeWrite(BACKUP_HEADROOM_PROBE_KEY, null, { remove: true });
  return probe.ok;
}

// Best effort: this never throws, so a failed copy cannot interrupt the caller.
function writeCorruptBackup(key, raw) {
  try {
    const existing = corruptBackupKeys(key);
    if (existing.length && localStorage.getItem(existing[0]) === raw) return "saved";
    const backupKey = `${key}${CORRUPT_KEY_MARKER}${Date.now()}`;
    if (!safeWrite(backupKey, raw, { raw: true }).ok) return "failed";
    if (!hasBackupHeadroom()) {
      safeWrite(backupKey, null, { remove: true });
      return "failed";
    }
    corruptBackupKeys(key)
      .slice(raw.length > LARGE_BACKUP_CHARS ? 1 : STORAGE_BACKUP_LIMIT)
      .forEach((oldKey) => safeWrite(oldKey, null, { remove: true }));
    return "saved";
  } catch (error) {
    console.error(`Could not back up unreadable storage key "${key}".`, error);
    return "failed";
  }
}

function backupCorruptValue(key, raw) {
  if (typeof raw !== "string") return "failed";
  const previous = backupOutcomes.get(key);
  if (previous?.raw === raw) return previous.outcome;
  const outcome = writeCorruptBackup(key, raw);
  if (outcome === "failed") {
    console.error(`No backup was saved for unreadable storage key "${key}".`);
  }
  backupOutcomes.set(key, { raw, outcome });
  return outcome;
}

function isHealthyStoredRaw(key, raw) {
  if (typeof raw !== "string") return false;
  try {
    return matchesStoredShape(JSON.parse(raw), STORED_SHAPES[key]);
  } catch {
    return false;
  }
}

// Earlier versions copied valid data here by mistake. A backup is kept while
// its live key is damaged, because it may be the only good copy.
function removeFalseCorruptBackups() {
  let removed = 0;
  try {
    Object.keys(STORED_SHAPES).forEach((key) => {
      const backups = corruptBackupKeys(key);
      if (!backups.length || !isHealthyStoredRaw(key, localStorage.getItem(key))) return;
      backups.forEach((backupKey) => {
        if (
          isHealthyStoredRaw(key, localStorage.getItem(backupKey)) &&
          safeWrite(backupKey, null, { remove: true }).ok
        ) {
          removed += 1;
        }
      });
    });
  } catch (error) {
    console.error("Could not clean up storage backups.", error);
  }
  if (removed) {
    console.info(`Mini Mart storage: removed ${removed} false corruption backup${removed === 1 ? "" : "s"}.`);
  }
  return removed;
}

function reportStorageIssue(key, status, error = null, backup = "failed") {
  if (storageIssues.some((entry) => entry.key === key && entry.status === status)) return;
  const issue = { key, status, backup, timestamp: new Date().toISOString() };
  storageIssues.push(issue);
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
      const error = new Error("Stored value has the wrong shape.");
      reportStorageIssue(key, "invalid", error, backupCorruptValue(key, saved));
      return { status: "invalid", value: clone(fallback), error, raw: saved };
    }
    return { status: "ok", value, error: null, raw: saved };
  } catch (error) {
    reportStorageIssue(key, "corrupt", error, backupCorruptValue(key, saved));
    return { status: "corrupt", value: clone(fallback), error, raw: saved };
  }
}

// A plain lookup would also find inherited names such as "constructor".
function ownValue(map, key) {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
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
        : ownValue(CATEGORY_ICON_LEGACY_ALIASES, storedIcon) ||
          ownValue(CATEGORY_ICON_PATH_TO_ID, storedIcon) ||
          DEFAULT_CATEGORY_ICON_ID;
      normalized[category] = iconId;
    },
  );
  return normalized;
}

function readCategoryIcons() {
  return normalizeCategoryIcons(read(CATEGORY_ICONS_KEY, {}).value);
}

// One-time data upgrades. Product normalization is not one of them: it has to
// keep running because products are saved without an id until their next read.
function runDataMigrations() {
  try {
    if (Number(localStorage.getItem(DATA_VERSION_KEY)) >= DATA_VERSION) return;
    const icons = read(CATEGORY_ICONS_KEY, {});
    if (icons.status === "ok") {
      const migrated = normalizeCategoryIcons(icons.value);
      if (JSON.stringify(migrated) !== JSON.stringify(icons.value)) {
        const result = safeWrite(CATEGORY_ICONS_KEY, migrated);
        if (!result.ok) {
          showStorageError(storageErrorMessage(result));
          return;
        }
      }
    }
    safeWrite(DATA_VERSION_KEY, String(DATA_VERSION), { raw: true });
  } catch (error) {
    console.error("Could not run data migrations.", error);
  }
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

/* =========================================================
   STOCK HISTORY
   Entries keep the original fields (product, previousStock,
   adjustment, stockAfter, reason, date). productId, source
   and reference are optional, so older entries stay valid.
========================================================= */

function readStockHistory() {
  const result = read(STOCK_HISTORY_KEY, []);
  if (result.status === "ok" || result.status === "missing") return result.value;
  // Damaged history must not stop sales once the original is safely backed up.
  const backedUp = storageIssues.some(
    (issue) => issue.key === STOCK_HISTORY_KEY && issue.backup === "saved",
  );
  return backedUp ? [] : null;
}

function stockHistoryExportState() {
  const state = read(STOCK_HISTORY_EXPORT_KEY, {}).value;
  return {
    exportedAt: String(state.exportedAt || ""),
    droppedUnexported: Number(state.droppedUnexported) || 0,
  };
}

// Compares two product lists. New products start from 0 and removed ones end at 0.
function stockChanges(previous, next, context = {}) {
  const byId = new Map(previous.filter((product) => product.id).map((product) => [product.id, product]));
  const byName = new Map(previous.map((product) => [product.name, product]));
  const matched = new Set();
  const changes = next.map((product) => {
    const old = (product.id && byId.get(product.id)) || byName.get(product.name);
    if (old) matched.add(old);
    return { ...context, product, before: old ? Number(old.stock) || 0 : 0, after: Number(product.stock) || 0 };
  });
  previous
    .filter((product) => !matched.has(product))
    .forEach((product) => changes.push({ ...context, product, before: Number(product.stock) || 0, after: 0 }));
  return changes.filter((change) => change.before !== change.after);
}

function withStockChanges(history, changes) {
  const date = new Date().toISOString();
  return [
    ...history,
    ...changes
      .filter(({ before, after }) => Number.isFinite(before) && Number.isFinite(after) && before !== after)
      .map(({ product, before, after, reason = "other", source = "", reference = null }) => ({
        product: product.name,
        productId: product.id || null,
        previousStock: before,
        adjustment: Number((after - before).toFixed(3)),
        stockAfter: after,
        reason,
        source,
        reference,
        date,
      })),
  ];
}

// Takes one change or a list of them. Unchanged stock logs nothing.
function recordStockChange(changes) {
  const list = Array.isArray(changes) ? changes : [changes];
  if (!list.some(({ before, after }) => before !== after)) {
    return { ok: true, error: null, reason: null };
  }
  const history = readStockHistory();
  if (!history) {
    return { ok: false, error: new Error("Stock history could not be read."), reason: "unknown" };
  }
  const next = withStockChanges(history, list);
  const kept = next.slice(-STOCK_HISTORY_LIMIT);
  const result = safeWrite(STOCK_HISTORY_KEY, kept);
  if (result.ok && kept.length < next.length) {
    const state = stockHistoryExportState();
    const dropped = next
      .slice(0, next.length - kept.length)
      .filter((entry) => String(entry.date) > state.exportedAt).length;
    if (dropped) {
      safeWrite(STOCK_HISTORY_EXPORT_KEY, {
        ...state,
        droppedUnexported: state.droppedUnexported + dropped,
      });
    }
  }
  return result;
}

function stockHistoryWarning() {
  const history = read(STOCK_HISTORY_KEY, []).value;
  const { exportedAt, droppedUnexported } = stockHistoryExportState();
  const unexported = history.filter((entry) => String(entry.date) > exportedAt).length;
  if (droppedUnexported) {
    return `${droppedUnexported} older stock history ${droppedUnexported === 1 ? "entry was" : "entries were"} removed before being exported. Only the newest ${STOCK_HISTORY_LIMIT} are kept, so export it now.`;
  }
  if (unexported >= STOCK_HISTORY_WARNING_AT) {
    return `${unexported} stock history entries have not been exported. Only the newest ${STOCK_HISTORY_LIMIT} are kept, so export it soon.`;
  }
  return "";
}

window.miniMartDB = {
  readStorage(key, fallback, validator = null) {
    return read(key, fallback, validator);
  },
  // Unvalidated text for rollback snapshots, or null if the key is not set.
  rawValue(key) {
    return localStorage.getItem(key);
  },
  removeFalseCorruptBackups,
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
      const seeded = safeWrite(CATEGORIES_KEY, result.value);
      if (!seeded.ok) showStorageError(storageErrorMessage(seeded));
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
    const icons = readCategoryIcons();
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
    const saved = readCategoryIcons();
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
    const icons = readCategoryIcons();
    icons[category] = Object.prototype.hasOwnProperty.call(
      CATEGORY_ICON_ALLOWLIST,
      iconId,
    )
      ? iconId
      : DEFAULT_CATEGORY_ICON_ID;
    return write(CATEGORY_ICONS_KEY, icons);
  },
  categoryIconId(category) {
    const icons = readCategoryIcons();
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
  seedProductNames() {
    return seedProducts.map((product) => product.name);
  },
  products() {
    const productsResult = read(PRODUCTS_KEY, seedProducts);
    const deletedNamesResult = read(DELETED_PRODUCTS_KEY, []);
    const deletedNames = new Set(deletedNamesResult.value);
    const products = normalizeProducts(productsResult.value).filter(
      (product) => !deletedNames.has(product.name),
    );
    if (
      (productsResult.status === "ok" || productsResult.status === "missing") &&
      JSON.stringify(products) !== productsResult.raw
    ) {
      const seeded = stockChanges(
        productsResult.status === "ok" ? productsResult.value : [],
        products,
        { reason: "initial", source: "Seed data" },
      ).filter((change) => change.after !== 0);
      const historyResult = recordStockChange(seeded);
      const result = historyResult.ok ? safeWrite(PRODUCTS_KEY, products) : historyResult;
      if (!result.ok) showStorageError(storageErrorMessage(result));
    }
    return products;
  },
  // stockContext says why stock changed: { reason, source, reference }.
  saveProducts(products, stockContext = {}) {
    const stored = read(PRODUCTS_KEY, []);
    const changes = stored.status === "ok" || stored.status === "missing"
      ? stockChanges(stored.value, products, stockContext)
      : [];
    const snapshot = [PRODUCTS_KEY, DELETED_PRODUCTS_KEY, STOCK_HISTORY_KEY]
      .map((key) => [key, localStorage.getItem(key)]);
    const undo = () => snapshot.forEach(([key, raw]) => {
      safeWrite(key, raw, raw === null ? { remove: true } : { raw: true });
    });
    const historyResult = recordStockChange(changes);
    if (!historyResult.ok) {
      showStorageError(storageErrorMessage(historyResult));
      return historyResult;
    }
    const names = new Set(products.map((product) => product.name));
    const deletedNames = new Set(read(DELETED_PRODUCTS_KEY, []).value);
    seedProducts.forEach((product) => {
      if (names.has(product.name)) deletedNames.delete(product.name);
      else deletedNames.add(product.name);
    });
    const deletedResult = write(DELETED_PRODUCTS_KEY, [...deletedNames]);
    if (!deletedResult.ok) {
      undo();
      return deletedResult;
    }
    const productsResult = write(PRODUCTS_KEY, products);
    if (!productsResult.ok) undo();
    return productsResult;
  },
  stockChanges,
  recordStockChange,
  withStockChanges,
  stockHistory: readStockHistory,
  stockHistoryWarning,
  stockHistoryLimit: () => STOCK_HISTORY_LIMIT,
  markStockHistoryExported() {
    return safeWrite(STOCK_HISTORY_EXPORT_KEY, {
      exportedAt: new Date().toISOString(),
      droppedUnexported: 0,
    });
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

removeFalseCorruptBackups();
runDataMigrations();
