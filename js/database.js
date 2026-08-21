const PRODUCTS_KEY = "miniMartProducts";
const SALES_KEY = "miniMartSales";
const CATEGORIES_KEY = "miniMartCategories";
const CATEGORY_ICONS_KEY = "miniMartCategoryIcons";

const seedProducts = [
  {
    name: "Coke 1.5L",
    category: "Beverages",
    price: 65,
    stock: 23,
    icon: "▣",
    accent: "var(--blue)",
  },
  {
    name: "Sprite 1.5L",
    category: "Beverages",
    price: 65,
    stock: 18,
    icon: "▣",
    accent: "var(--blue)",
  },
  {
    name: "Nature's Spring 500ml",
    category: "Beverages",
    price: 12,
    stock: 35,
    icon: "▣",
    accent: "var(--blue)",
  },
  {
    name: "Nestea Lemon 1L",
    category: "Beverages",
    price: 58,
    stock: 16,
    icon: "▣",
    accent: "var(--blue)",
  },
  {
    name: "Lucky Me Pancit Canton",
    category: "Instant Food",
    price: 15,
    stock: 50,
    icon: "⌁",
    accent: "var(--red)",
  },
  {
    name: "Lucky Me Chicken Noodles",
    category: "Instant Food",
    price: 14,
    stock: 42,
    icon: "⌁",
    accent: "var(--red)",
  },
  {
    name: "Payless Xtra Big",
    category: "Instant Food",
    price: 18,
    stock: 28,
    icon: "⌁",
    accent: "var(--red)",
  },
  {
    name: "Nissin Cup Noodles",
    category: "Instant Food",
    price: 32,
    stock: 20,
    icon: "⌁",
    accent: "var(--red)",
  },
  {
    name: "Piattos 40g",
    category: "Snacks",
    price: 22,
    stock: 29,
    icon: "◉",
    accent: "var(--gold)",
  },
  {
    name: "Chippy Barbecue 110g",
    category: "Snacks",
    price: 18,
    stock: 34,
    icon: "◉",
    accent: "var(--gold)",
  },
  {
    name: "Choc Nut 24g",
    category: "Snacks",
    price: 10,
    stock: 45,
    icon: "◉",
    accent: "var(--gold)",
  },
  {
    name: "Nova Country 78g",
    category: "Snacks",
    price: 28,
    stock: 25,
    icon: "◉",
    accent: "var(--gold)",
  },
  {
    name: "Bear Brand 33g",
    category: "Dairy",
    price: 14,
    stock: 40,
    icon: "♙",
    accent: "var(--green)",
  },
  {
    name: "Alaska Fortified Milk 1L",
    category: "Dairy",
    price: 92,
    stock: 14,
    icon: "♙",
    accent: "var(--green)",
  },
  {
    name: "Selecta Ice Cream Cup",
    category: "Dairy",
    price: 35,
    stock: 22,
    icon: "♙",
    accent: "var(--green)",
  },
  {
    name: "Yakult 5-Pack",
    category: "Dairy",
    price: 48,
    stock: 19,
    icon: "♙",
    accent: "var(--green)",
  },
  {
    name: "Skyflakes Crackers",
    category: "Snacks",
    price: 8,
    stock: 60,
    icon: "◉",
    accent: "var(--gold)",
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function read(key, fallback) {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : clone(fallback);
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(
    new CustomEvent("miniMartDatabaseChanged", { detail: { key } }),
  );
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
      category: product.category || seed.category || "Snacks",
      icon: product.icon || seed.icon || "◇",
      accent: product.accent || seed.accent || "var(--gold)",
    };
  });
}

window.miniMartDB = {
  categories() {
    const saved = localStorage.getItem(CATEGORIES_KEY);
    const categories = saved
      ? JSON.parse(saved)
      : [...new Set(seedProducts.map((product) => product.category))];
    if (!saved)
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    return categories;
  },
  saveCategories(categories) {
    write(CATEGORIES_KEY, [...new Set(categories)]);
  },
  categoryIcon(category) {
    const defaults = {
      Beverages: "Icons/beverages.png",
      "Instant Food": "Icons/instant-food.png",
      Snacks: "Icons/snacks.png",
      Dairy: "Icons/dairy.png",
      Bakery: "Icons/bread.png",
    };
    const saved = read(CATEGORY_ICONS_KEY, {});
    return saved[category] || defaults[category] || "Icons/bread.png";
  },
  saveCategoryIcon(category, iconPath) {
    const icons = read(CATEGORY_ICONS_KEY, {});
    icons[category] = iconPath;
    write(CATEGORY_ICONS_KEY, icons);
  },
  products() {
    const saved = localStorage.getItem(PRODUCTS_KEY);
    if (!saved) write(PRODUCTS_KEY, seedProducts);
    const products = normalizeProducts(read(PRODUCTS_KEY, seedProducts));
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
    return products;
  },
  saveProducts(products) {
    write(PRODUCTS_KEY, products);
  },
  sales() {
    return read(SALES_KEY, []);
  },
  recordSale(items, total) {
    const sales = this.sales();
    sales.push({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      items: clone(items),
      total,
    });
    write(SALES_KEY, sales);
  },
};
