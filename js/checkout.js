const cart = new Map();
const peso = (value) => `&#8369;${value.toFixed(2)}`;
const receiptDate = document.getElementById("receiptDate");
const search = document.getElementById("search");
const sellButton = document.getElementById("sellButton");
const paymentPanel = document.getElementById("paymentPanel");
const amountGiven = document.getElementById("amountGiven");
const changeAmount = document.getElementById("changeAmount");
const paymentError = document.getElementById("paymentError");
const productsSection = document.getElementById("products");
let productCards = [];

function categoryIconPath(category) {
  return window.miniMartDB.categoryIcon(category);
}

function renderProducts() {
  const products = window.miniMartDB.products();
  const categories = [
    "Beverages",
    "Instant Food",
    "Snacks",
    "Dairy",
    ...new Set(products.map((product) => product.category)),
  ];
  productsSection.innerHTML =
    categories
      .filter(
        (category, index) =>
          categories.indexOf(category) === index &&
          products.some((product) => product.category === category),
      )
      .map((category) => {
        const categoryProducts = products
          .filter((product) => product.category === category)
          .sort((first, second) => first.name.localeCompare(second.name));
        const first = categoryProducts[0];
        const categoryIcon = `<img src="${categoryIconPath(category)}" alt="" />`;
        const header = `<div class="checkout-category" style="--accent:${first.accent}" data-category="${category}" data-open="false" tabindex="0" role="button" aria-expanded="false"><span class="category-toggle">${categoryIcon}</span><strong>${category}</strong><small>${categoryProducts.length} products</small><b>＋</b></div>`;
        const cards = categoryProducts
          .map(
            (product) =>
              `<article class="product" style="--accent:${product.accent}" data-category="${product.category}" data-name="${product.name}" data-price="${product.price}" data-stock="${product.stock}"><div class="product-head"><span class="product-icon"><img src="${categoryIconPath(product.category)}" alt="" /></span><span class="category">${product.category.toUpperCase()}</span></div><h2>${product.name}</h2><p class="price">${peso(product.price)}</p><span class="stock">${product.stock} left</span></article>`,
          )
          .join("");
        return header + cards;
      })
      .join("") +
    '<div class="empty-results" id="emptyResults">No products found.</div>';
  productCards = [...productsSection.querySelectorAll(".product")];
  productCards.forEach((product) =>
    product.addEventListener("click", addToCart),
  );
  filterProducts();
}

function refreshProductCards() {
  const stockByName = new Map(
    window.miniMartDB
      .products()
      .map((product) => [product.name, product.stock]),
  );
  productCards.forEach((product) => {
    const stock = stockByName.get(product.dataset.name) ?? 0;
    product.dataset.stock = stock;
    product.querySelector(".stock").textContent = `${stock} left`;
    product.style.opacity = stock ? "1" : ".55";
  });
}

function addToCart() {
  const name = this.dataset.name;
  const stock = Number(this.dataset.stock);
  const item = cart.get(name) || {
    name,
    price: Number(this.dataset.price),
    quantity: 0,
  };
  if (item.quantity >= stock) return;
  item.quantity += 1;
  cart.set(name, item);
  renderCart();
}

function filterProducts() {
  const query = search.value.toLowerCase().trim();
  let visible = 0;
  productCards.forEach((product) => {
    const match = product.dataset.name.toLowerCase().includes(query);
    const group = productsSection.querySelector(
      `.checkout-category[data-category="${CSS.escape(product.dataset.category)}"]`,
    );
    const open = group?.dataset.open === "true" || query.length > 0;
    product.style.display = match && open ? "" : "none";
    if (match) visible += 1;
  });
  productsSection.querySelectorAll(".checkout-category").forEach((group) => {
    group.style.display = productCards.some(
      (product) =>
        product.dataset.category === group.dataset.category &&
        product.dataset.name.toLowerCase().includes(query),
    )
      ? ""
      : "none";
  });
  document.getElementById("emptyResults").style.display = visible
    ? "none"
    : "block";
}

receiptDate.textContent = new Date().toLocaleString("en-US", {
  month: "numeric",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});
search.addEventListener("input", filterProducts);
productsSection.addEventListener("click", (event) => {
  const group = event.target.closest(".checkout-category");
  if (!group) return;
  const open = group.dataset.open === "true";
  group.dataset.open = String(!open);
  group.setAttribute("aria-expanded", String(!open));
  filterProducts();
});
productsSection.addEventListener("keydown", (event) => {
  if (
    event.target.closest(".checkout-category") &&
    (event.key === "Enter" || event.key === " ")
  ) {
    event.preventDefault();
    event.target.closest(".checkout-category").click();
  }
});

sellButton.addEventListener("click", () => {
  const entries = [...cart.values()];
  const total = getCartTotal();
  const paid = Number(amountGiven.value);
  if (!entries.length || !Number.isFinite(paid) || paid < total) {
    updatePayment();
    return;
  }
  const inventory = window.miniMartDB.products();
  entries.forEach((item) => {
    const product = inventory.find((entry) => entry.name === item.name);
    if (product) product.stock -= item.quantity;
  });
  const saleItems = entries.map((item) => {
    const product = inventory.find((entry) => entry.name === item.name);
    return {
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      costPrice: window.miniMartDB.isKnownCost(product?.costPrice)
        ? Number(product.costPrice)
        : null,
    };
  });
  window.miniMartDB.saveProducts(inventory);
  window.miniMartDB.recordSale(saleItems, getCartTotal());
  cart.clear();
  amountGiven.value = "";
  renderProducts();
  renderCart();
});

function updatePayment() {
  const total = getCartTotal();
  const paid = Number(amountGiven.value);
  const validPayment = Number.isFinite(paid) && amountGiven.value !== "";
  const change = validPayment ? paid - total : 0;
  changeAmount.innerHTML = peso(Math.max(change, 0));
  const insufficient = validPayment && paid < total;
  paymentError.hidden = !insufficient;
  sellButton.disabled = !cart.size || insufficient || !validPayment;
}

amountGiven.addEventListener("input", updatePayment);

function getCartTotal() {
  return [...cart.values()].reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
}

function renderCart() {
  const cartItems = document.getElementById("cartItems");
  const entries = [...cart.values()];
  document.getElementById("cartEmpty").style.display = entries.length
    ? "none"
    : "grid";
  cartItems.style.display = entries.length ? "block" : "none";
  document.getElementById("total").hidden = !entries.length;
  paymentPanel.hidden = !entries.length;
  cartItems.innerHTML = entries
    .map(
      (item) =>
        `<div class="cart-row"><span>${item.name}<small>${item.quantity} x ${peso(item.price)}</small></span><span><strong>${peso(item.quantity * item.price)}</strong><button class="remove" data-remove="${item.name}" aria-label="Remove ${item.name}">x</button></span></div>`,
    )
    .join("");
  document.getElementById("totalAmount").innerHTML = peso(getCartTotal());
  updatePayment();
  cartItems.querySelectorAll("[data-remove]").forEach((button) =>
    button.addEventListener("click", () => {
      cart.delete(button.dataset.remove);
      renderCart();
    }),
  );
}

renderProducts();
renderCart();
