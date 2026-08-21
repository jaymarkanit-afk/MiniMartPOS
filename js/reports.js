const peso = (value) => `&#8369;${value.toFixed(2)}`;
const products = window.miniMartDB.products();
const sales = window.miniMartDB.sales();
const itemCounts = new Map();
const categoryCounts = new Map();
const lastUpdated = document.getElementById("lastUpdated");
const LOW_STOCK_THRESHOLD = 10;
const lowStockProductNames = new Set(
  products
    .filter((product) => product.stock <= LOW_STOCK_THRESHOLD)
    .map((product) => product.name),
);

const CATEGORY_ORDER = [
  "Beverages",
  "Instant Food",
  "Snacks",
  "Dairy",
  "Other",
];
const CATEGORY_COLORS = {
  Beverages: "var(--blue)",
  "Instant Food": "var(--red)",
  Snacks: "var(--gold)",
  Dairy: "var(--green)",
  Other: "#8a7663",
};

lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
window.addEventListener("storage", (event) => {
  if (event.key === "miniMartProducts" || event.key === "miniMartSales")
    window.location.reload();
});
window.addEventListener("miniMartDatabaseChanged", (event) => {
  if (
    event.detail.key === "miniMartProducts" ||
    event.detail.key === "miniMartSales"
  )
    window.location.reload();
});

sales.forEach((sale) =>
  sale.items.forEach((item) => {
    itemCounts.set(item.name, (itemCounts.get(item.name) || 0) + item.quantity);
    const product = products.find((entry) => entry.name === item.name);
    const category = product?.category || "Other";
    categoryCounts.set(
      category,
      (categoryCounts.get(category) || 0) + item.quantity,
    );
  }),
);

const salesByDay = sales.reduce((groups, sale) => {
  const key = new Date(sale.date).toDateString();
  const current = groups.get(key) || [];
  current.push(sale);
  groups.set(key, current);
  return groups;
}, new Map());

const trendDays = [...Array(7)].map((_, index) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (6 - index));
  return date;
});
const trendDayStats = trendDays.map((day) => {
  const key = day.toDateString();
  const daySales = salesByDay.get(key) || [];
  return {
    day,
    revenue: daySales.reduce((sum, sale) => sum + sale.total, 0),
    transactions: daySales.length,
    items: daySales.reduce(
      (sum, sale) =>
        sum +
        sale.items.reduce((itemTotal, item) => itemTotal + item.quantity, 0),
      0,
    ),
    lowStockItemSales: daySales.reduce(
      (sum, sale) =>
        sum +
        sale.items.reduce(
          (itemTotal, item) =>
            itemTotal +
            (lowStockProductNames.has(item.name) ? item.quantity : 0),
          0,
        ),
      0,
    ),
  };
});

const percentageDelta = (current, previous) => {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return ((current - previous) / previous) * 100;
};

const setTrendNote = (elementId, current, previous, label) => {
  const note = document.getElementById(elementId);
  const delta = percentageDelta(current, previous);
  if (current === previous) {
    note.textContent = `0% vs yesterday ${label}`;
    note.classList.remove("trend-up", "trend-down");
    note.classList.add("trend-flat");
    return;
  }
  const direction = delta >= 0 ? "up" : "down";
  const arrow = delta >= 0 ? "▲" : "▼";
  note.textContent = `${arrow} ${Math.abs(delta).toFixed(0)}% vs yesterday ${label}`;
  note.classList.remove("trend-up", "trend-down", "trend-flat");
  note.classList.add(`trend-${direction}`);
};

const todayStats = trendDayStats[trendDayStats.length - 1] || {
  revenue: 0,
  transactions: 0,
  items: 0,
};
const yesterdayStats = trendDayStats[trendDayStats.length - 2] || {
  revenue: 0,
  transactions: 0,
  items: 0,
};

const todayRevenue = todayStats.revenue;
const productsSold = sales.reduce(
  (sum, sale) =>
    sum + sale.items.reduce((items, item) => items + item.quantity, 0),
  0,
);
document.getElementById("todayRevenue").innerHTML = peso(todayRevenue);
document.getElementById("todaySales").textContent = todayStats.transactions;
document.getElementById("productsSold").textContent = productsSold;
document.getElementById("productsSoldNote").textContent = "Across all sales";
const lowStockProducts = products
  .filter((product) => product.stock <= LOW_STOCK_THRESHOLD)
  .sort((first, second) => first.stock - second.stock);
document.getElementById("lowStockItems").textContent = lowStockProducts.length;
setTrendNote(
  "todayRevenueNote",
  todayStats.revenue,
  yesterdayStats.revenue,
  "revenue",
);
setTrendNote(
  "todaySalesNote",
  todayStats.transactions,
  yesterdayStats.transactions,
  "transactions",
);
setTrendNote(
  "productsSoldNote",
  todayStats.items,
  yesterdayStats.items,
  "items sold",
);
setTrendNote(
  "lowStockNote",
  todayStats.lowStockItemSales,
  yesterdayStats.lowStockItemSales,
  "low-stock sales",
);
document.getElementById("lowStockIntro").textContent =
  `Products with ${LOW_STOCK_THRESHOLD} units or fewer remaining.`;
document.getElementById("lowStockList").innerHTML =
  lowStockProducts
    .map(
      (product) =>
        `<div class="low-stock-row"><span><strong>${product.name}</strong><small>${product.category} · ${product.price.toFixed(2)} per unit</small></span><b class="low-stock-amount">${product.stock} left</b></div>`,
    )
    .join("") ||
  '<div class="low-stock-empty">All products have healthy stock levels.</div>';

const lowStockModal = document.getElementById("lowStockModal");
const closeLowStock = () => {
  lowStockModal.hidden = true;
  document.getElementById("lowStockTitle").textContent = "Low Stock Products";
  [...inventoryBarsElement.querySelectorAll(".inventory-bar")].forEach(
    (bar) => {
      bar.classList.remove("active");
    },
  );
};
const openLowStock = () => {
  lowStockModal.hidden = false;
  document.getElementById("closeLowStock").focus();
};
document
  .getElementById("closeLowStock")
  .addEventListener("click", closeLowStock);
document
  .getElementById("cancelLowStock")
  .addEventListener("click", closeLowStock);
lowStockModal.addEventListener("click", (event) => {
  if (event.target === lowStockModal) closeLowStock();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !lowStockModal.hidden) closeLowStock();
});

const productLastSoldTime = sales.reduce((latest, sale) => {
  const saleTimestamp = new Date(sale.date).getTime();
  sale.items.forEach((item) => {
    const current = latest.get(item.name) || 0;
    if (saleTimestamp > current) latest.set(item.name, saleTimestamp);
  });
  return latest;
}, new Map());
const topProducts = [...itemCounts.entries()]
  .sort((first, second) => {
    const quantityDifference = second[1] - first[1];
    if (quantityDifference !== 0) return quantityDifference;
    const secondRecent = productLastSoldTime.get(second[0]) || 0;
    const firstRecent = productLastSoldTime.get(first[0]) || 0;
    if (secondRecent !== firstRecent) return secondRecent - firstRecent;
    return first[0].localeCompare(second[0]);
  })
  .slice(0, 5);
const maxSold = Math.max(...topProducts.map(([, quantity]) => quantity), 1);
document.getElementById("topProducts").innerHTML =
  topProducts
    .map(
      ([name, quantity], index) =>
        `<li><span class="rank-badge rank-${index + 1}">${String(index + 1).padStart(2, "0")}</span><span class="product-name">${name}</span><span class="product-meter" style="--fill:${Math.round((quantity / maxSold) * 100)}%"><i></i></span><span class="report-quantity">${quantity} sold</span></li>`,
    )
    .join("") ||
  `<li><span class="rank-badge">--</span><span class="product-name">No sales yet</span><span class="product-meter"><i></i></span><span class="report-quantity">0 sold</span></li>`;

const categoryTotal = [...categoryCounts.values()].reduce(
  (sum, value) => sum + value,
  0,
);
let categoryPosition = 0;
const orderedCategoryEntries = CATEGORY_ORDER.filter((category) =>
  categoryCounts.has(category),
).map((category) => [category, categoryCounts.get(category)]);
const categoryStops = orderedCategoryEntries
  .map(([category, amount]) => {
    const start = categoryPosition;
    categoryPosition += categoryTotal ? (amount / categoryTotal) * 100 : 0;
    return `${CATEGORY_COLORS[category] || CATEGORY_COLORS.Other} ${start}% ${categoryPosition}%`;
  })
  .join(", ");
document.getElementById("categoryChart").style.background = categoryTotal
  ? `conic-gradient(${categoryStops})`
  : "conic-gradient(#d9d7cd 0 100%)";
document.getElementById("categoryTotal").textContent = categoryTotal;
document.getElementById("categoryLegend").innerHTML =
  orderedCategoryEntries
    .map(
      ([category, amount]) =>
        `<span style="--legend:${CATEGORY_COLORS[category] || CATEGORY_COLORS.Other}"><i></i><b>${category}</b><em>${categoryTotal ? Math.round((amount / categoryTotal) * 100) : 0}%</em></span>`,
    )
    .join("") ||
  '<span style="--legend:#d9d7cd"><i></i><b>No sales</b><em>0%</em></span>';
let labelPosition = 0;
document.getElementById("categoryLabels").innerHTML = orderedCategoryEntries
  .map(([category, amount]) => {
    const percentage = categoryTotal ? (amount / categoryTotal) * 100 : 0;
    const angle =
      (((labelPosition + percentage / 2) * 3.6 - 90) * Math.PI) / 180;
    labelPosition += percentage;
    const left = 50 + Math.cos(angle) * 38;
    const top = 50 + Math.sin(angle) * 38;
    return `<span class="donut-label" style="left:${left}%;top:${top}%">${Math.round(percentage)}%</span>`;
  })
  .join("");

const trendValues = trendDayStats.map((entry) => entry.revenue);
const maxTrend = Math.max(...trendValues, 1);
const points = trendValues
  .map(
    (value, index) => `${(index / 6) * 100},${138 - (value / maxTrend) * 112}`,
  )
  .join(" ");
document.getElementById("trendChart").innerHTML =
  `<svg class="trend-line" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="var(--blue)" stroke-width="1.8" vector-effect="non-scaling-stroke"/><polyline points="${points} 100,150 0,150" fill="rgba(43,117,145,.08)" stroke="none"/></svg>`;
document.getElementById("trendLabels").innerHTML = trendDays
  .map(
    (day) =>
      `<span>${day.toLocaleDateString("en-US", { weekday: "short" })}</span>`,
  )
  .join("");

function renderStackedChart(
  elementId,
  buckets,
  labels,
  colors,
  metric = "revenue",
) {
  const values =
    metric === "transactions"
      ? buckets.map((bucket) => ({ Transactions: bucket.sales.length }))
      : buckets.map((bucket) => {
          const totals = {};
          bucket.sales.forEach((sale) =>
            sale.items.forEach((item) => {
              const product = products.find(
                (entry) => entry.name === item.name,
              );
              const category = product?.category || "Other";
              totals[category] =
                (totals[category] || 0) + item.price * item.quantity;
            }),
          );
          return totals;
        });
  const totals = values.map((value) =>
    Object.values(value).reduce((sum, amount) => sum + amount, 0),
  );
  const maxValue = Math.max(...totals, 1);
  const chartMax =
    metric === "transactions"
      ? Math.max(4, Math.ceil(maxValue / 4) * 4)
      : maxValue;
  const points = totals
    .map(
      (value, index) =>
        `${((index + 0.5) / buckets.length) * 100},${138 - (value / chartMax) * 125}`,
    )
    .join(" ");
  const ticks =
    metric === "transactions"
      ? [chartMax, chartMax * 0.75, chartMax * 0.5, chartMax * 0.25, 0]
      : [maxValue, maxValue * 0.75, maxValue * 0.5, maxValue * 0.25, 0];
  const axisLabels =
    metric === "transactions"
      ? ticks.map((value) => Math.round(value).toString())
      : ticks.map((value) => peso(value).replace(".00", ""));
  const bars = values
    .map(
      (value, index) =>
        `<div class="period-column" data-value="${totals[index]}" data-period="${labels[index]}"><div class="period-stack">${Object.entries(
          value,
        )
          .map(
            ([category, amount]) =>
              `<i style="height:${(amount / chartMax) * 125}px;background:${
                metric === "transactions"
                  ? "var(--blue)"
                  : colors[category] || "#8a7663"
              }"></i>`,
          )
          .join("")}</div><span>${labels[index]}</span></div>`,
    )
    .join("");
  const chart = document.getElementById(elementId);
  chart.innerHTML = `<div class="period-y-axis">${axisLabels.map((value) => `<span>${value}</span>`).join("")}</div><div class="period-plot"><div class="period-columns">${bars}</div><svg class="period-line" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="var(--ink)" stroke-width="2" vector-effect="non-scaling-stroke"/><polyline points="${points} 100,140 0,140" fill="rgba(24,35,29,.06)" stroke="none"/></svg><div class="period-tooltip" role="status"></div></div>`;
  const plot = chart.querySelector(".period-plot");
  const tooltip = chart.querySelector(".period-tooltip");
  let dragging = false;
  const showValue = (event) => {
    const rect = plot.getBoundingClientRect();
    const columns = [...plot.querySelectorAll(".period-column")];
    const index = Math.max(
      0,
      Math.min(
        columns.length - 1,
        Math.round(
          ((event.clientX - rect.left) / rect.width) * (columns.length - 1),
        ),
      ),
    );
    const column = columns[index];
    const numericValue = Number(column.dataset.value);
    const primaryValue =
      metric === "transactions"
        ? `${Math.round(numericValue)} transactions`
        : peso(numericValue);
    const helperText =
      metric === "transactions" ? "completed transactions" : "income generated";
    tooltip.innerHTML = `<b>${column.dataset.period}</b><strong>${primaryValue}</strong><small>${helperText}</small>`;
    tooltip.style.left = `${column.offsetLeft + column.offsetWidth / 2}px`;
    tooltip.classList.add("visible");
  };
  plot.addEventListener("pointerdown", (event) => {
    dragging = true;
    plot.setPointerCapture(event.pointerId);
    showValue(event);
  });
  plot.addEventListener("pointermove", (event) => {
    if (dragging) showValue(event);
  });
  plot.addEventListener("pointerup", () => {
    dragging = false;
  });
  plot.addEventListener("pointerleave", () => {
    if (!dragging) tooltip.classList.remove("visible");
  });
}
const weekBuckets = trendDays.map((day) => ({
  sales: sales.filter(
    (sale) => new Date(sale.date).toDateString() === day.toDateString(),
  ),
}));
renderStackedChart(
  "weeklyChart",
  weekBuckets,
  trendDays.map((day) => day.toLocaleDateString("en-US", { weekday: "short" })),
  CATEGORY_COLORS,
  "transactions",
);

const monthBuckets = [...Array(6)].map((_, index) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - (5 - index));
  return date;
});
const monthValues = monthBuckets.map((month) =>
  sales
    .filter((sale) => {
      const date = new Date(sale.date);
      return (
        date.getFullYear() === month.getFullYear() &&
        date.getMonth() === month.getMonth()
      );
    })
    .reduce((sum, sale) => sum + sale.total, 0),
);
const monthSalesBuckets = monthBuckets.map((month) => ({
  sales: sales.filter((sale) => {
    const date = new Date(sale.date);
    return (
      date.getFullYear() === month.getFullYear() &&
      date.getMonth() === month.getMonth()
    );
  }),
}));
renderStackedChart(
  "monthlyChart",
  monthSalesBuckets,
  monthBuckets.map((month) =>
    month.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
  ),
  CATEGORY_COLORS,
);

const categoryInventory = [
  ...products.reduce((groups, product) => {
    const current = groups.get(product.category) || {
      total: 0,
      products: [],
      lowItems: [],
    };
    current.total += product.stock;
    current.products.push(product);
    if (product.stock <= LOW_STOCK_THRESHOLD)
      current.lowItems.push(product.name);
    groups.set(product.category, current);
    return groups;
  }, new Map()),
];
const orderedCategoryInventory = CATEGORY_ORDER.filter((category) =>
  categoryInventory.some(([name]) => name === category),
).map((category) => categoryInventory.find(([name]) => name === category));
const maxStock = Math.max(
  ...orderedCategoryInventory.map(([, values]) => values.total),
  1,
);
const inventoryBarsElement = document.getElementById("inventoryBars");
inventoryBarsElement.innerHTML = orderedCategoryInventory
  .map(([category, values]) => {
    const height = Math.max((values.total / maxStock) * 100, 4);
    const thresholdHeight = (LOW_STOCK_THRESHOLD / maxStock) * 100;
    return `<button type="button" class="inventory-bar ${values.lowItems.length ? "is-low" : ""}" data-category="${category}" data-low-count="${values.lowItems.length}" title="${category}: ${values.total} units across products"><strong>${values.total}</strong><div class="bar-stack"><span class="bar-stock" style="height:${height}%;background:${CATEGORY_COLORS[category] || CATEGORY_COLORS.Other}"></span><span class="bar-threshold" style="bottom:${Math.min(thresholdHeight, 100)}%"></span></div><span>${category}</span></button>`;
  })
  .join("");

const highlightLowStockCategory = (category) => {
  [...inventoryBarsElement.querySelectorAll(".inventory-bar")].forEach(
    (bar) => {
      bar.classList.toggle("active", bar.dataset.category === category);
    },
  );
  const categoryInfo = orderedCategoryInventory.find(
    ([name]) => name === category,
  );
  if (!categoryInfo) return;
  const [, values] = categoryInfo;
  const lowList = values.products
    .filter((product) => product.stock <= LOW_STOCK_THRESHOLD)
    .sort((first, second) => first.stock - second.stock)
    .map(
      (product) =>
        `<div class="low-stock-row"><span><strong>${product.name}</strong><small>${product.category} · ${product.price.toFixed(2)} per unit</small></span><b class="low-stock-amount">${product.stock} left</b></div>`,
    )
    .join("");
  document.getElementById("lowStockTitle").textContent =
    `${category} Low Stock`;
  document.getElementById("lowStockList").innerHTML =
    lowList ||
    '<div class="low-stock-empty">No low-stock products in this category.</div>';
  openLowStock();
};

inventoryBarsElement.querySelectorAll(".inventory-bar").forEach((bar) => {
  bar.addEventListener("click", () => {
    highlightLowStockCategory(bar.dataset.category);
  });
});

document.getElementById("lowStockMetric").addEventListener("click", () => {
  const firstLowCategory = orderedCategoryInventory.find(
    ([, values]) => values.lowItems.length > 0,
  );
  if (firstLowCategory) {
    highlightLowStockCategory(firstLowCategory[0]);
    return;
  }
  document.getElementById("lowStockTitle").textContent = "Low Stock Products";
  openLowStock();
});

document
  .getElementById("lowStockMetric")
  .addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      document.getElementById("lowStockMetric").click();
    }
  });

document.getElementById("recentSales").innerHTML =
  sales
    .slice(-5)
    .reverse()
    .map((sale) => {
      const items = sale.items
        .map((item) => `${item.name} x${item.quantity}`)
        .join(", ");
      return `<div class="sale-row"><div class="sale-details"><div class="sale-date">${new Date(sale.date).toLocaleString()}</div><div>${items}</div></div><strong class="sale-total">${peso(sale.total)}</strong></div>`;
    })
    .join("") || `<div class="sale-details">No sales recorded yet.</div>`;
