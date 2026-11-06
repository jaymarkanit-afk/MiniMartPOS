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

// A USB reader's text is untrusted, so only these characters are accepted. Otherwise the
// code is exactly what the reader sent, uppercased: no zeros removed, nothing converted.
function normalizeCardCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9 :._-]{4,32}$/.test(code) ? code : "";
}

window.normalizeCardCode = normalizeCardCode;

function cardEnding(code) {
  return String(code).slice(-4);
}

function joinNames(names) {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// Card codes held by more than one customer, with the customers that hold them.
function duplicateCardGroups(customers) {
  const byCode = new Map();
  customers.forEach((customer) => {
    const code = normalizeCardCode(customer?.cardCode);
    if (code) byCode.set(code, [...(byCode.get(code) || []), customer]);
  });
  return [...byCode].filter(([, owners]) => owners.length > 1).map(([code, owners]) => ({ code, owners }));
}

// One dialog at a time. Only this file changes activeDialog.
let activeDialog = null;

function showDialog({ title, message, details = "", confirmLabel, cancelLabel = null, tone = "normal" }) {
  let finish;
  const closed = new Promise((resolve) => { finish = resolve; });
  activeDialog = closed;
  const opener = document.activeElement;
  const bodyOverflow = document.body.style.overflow;
  let backdrop = null;
  let buttons = [];

  const onKeydown = (event) => {
    // Pages also listen for keys, such as Escape on modals and barcode scanners.
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      close(false);
    } else if (event.key === "Tab") {
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement);
      const step = event.shiftKey ? -1 : 1;
      buttons[(index + step + buttons.length) % buttons.length].focus();
    }
  };

  function close(result) {
    if (activeDialog !== closed) return;
    activeDialog = null;
    window.removeEventListener("keydown", onKeydown, true);
    backdrop?.remove();
    document.body.style.overflow = bodyOverflow;
    if (opener?.isConnected) opener.focus?.();
    finish(result);
  }

  try {
    const danger = tone === "danger";
    const idBase = `confirmDialog${Date.now()}`;
    backdrop = document.createElement("div");
    backdrop.className = "confirm-dialog-backdrop";
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close(false);
    });
    const card = document.createElement("div");
    card.className = `confirm-dialog${danger ? " is-danger" : ""}`;
    card.setAttribute("role", "alertdialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", `${idBase}Title`);
    card.setAttribute("aria-describedby", `${idBase}Message`);
    const heading = document.createElement("div");
    heading.className = "confirm-dialog-heading";
    if (danger) {
      const icon = document.createElement("span");
      icon.className = "confirm-dialog-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "⚠";
      heading.append(icon);
    }
    const titleElement = document.createElement("h2");
    titleElement.id = `${idBase}Title`;
    titleElement.textContent = title;
    heading.append(titleElement);
    const body = document.createElement("div");
    body.id = `${idBase}Message`;
    const messageElement = document.createElement("p");
    messageElement.textContent = message;
    body.append(messageElement);
    if (details) {
      const detailsElement = document.createElement("p");
      detailsElement.className = "confirm-dialog-details";
      detailsElement.textContent = details;
      body.append(detailsElement);
    }
    const actions = document.createElement("div");
    actions.className = "confirm-dialog-actions";
    const makeButton = (label, className, result) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `confirm-dialog-button ${className}`;
      button.textContent = label;
      button.addEventListener("click", () => close(result));
      actions.append(button);
      return button;
    };
    const cancelButton = cancelLabel ? makeButton(cancelLabel, "is-cancel", false) : null;
    const confirmButton = makeButton(confirmLabel, "is-confirm", true);
    buttons = cancelButton ? [cancelButton, confirmButton] : [confirmButton];
    card.append(heading, body, actions);
    backdrop.append(card);
    document.body.append(backdrop);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeydown, true);
    (danger && cancelButton ? cancelButton : confirmButton).focus();
  } catch (error) {
    console.error("The dialog could not be shown.", error);
    close(false);
  }
  return closed;
}

// Resolves true or false. tone is "normal" or "danger". A call while another dialog is
// open is refused and resolves false, so a question is never stacked or answered twice.
function confirmDialog({ title, message, details, confirmLabel = "Continue", cancelLabel = "Cancel", tone } = {}) {
  if (activeDialog) return Promise.resolve(false);
  return showDialog({ title, message, details, confirmLabel, cancelLabel, tone });
}

// A message with one button. If a dialog is open this waits its turn, so no message is lost.
async function alertDialog({ title, message, details, buttonLabel = "Got it", tone } = {}) {
  while (activeDialog) await activeDialog;
  await showDialog({ title, message, details, confirmLabel: buttonLabel, tone });
}

function categoryIconPath(category) {
  return window.miniMartDB.categoryIcon(category);
}
