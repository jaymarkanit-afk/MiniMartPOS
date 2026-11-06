"use strict";

/* =========================================================
   SHARED HELPERS
   Loaded first on every page. Every script shares this
   global scope, so a top-level const elsewhere must not
   reuse one of these names.
========================================================= */

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function peso(value) {
  return window.miniMartSettings.formatCurrency(value);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]);
}

function safeAccent(value, fallback = "var(--gold)") {
  return /^var\(--[a-z0-9-]+\)$/.test(String(value || "")) ? value : fallback;
}

// The name differs from settings.js, which uses lowStockThreshold for its input element.
function productLowStockThreshold(product) {
  const configured = Number(product?.restockMin);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : Number(window.miniMartSettings.get().lowStockThreshold) || 0;
}

function categoryIconPath(category) {
  return window.miniMartDB.categoryIcon(category);
}
