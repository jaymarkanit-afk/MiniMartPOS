void (async () => {
  const client = window.supabaseClient;

  const { data, error } = client
    ? await client.auth.getSession()
    : { data: null, error: true };

  if (error || !data.session?.user?.email_confirmed_at) {
    if (client) await client.auth.signOut();

    window.location.replace("login.html");
    return;
  }
  window.miniMartAuthReady = true;
  window.dispatchEvent(new Event("miniMartAuthReady"));
})();

const cart = new Map();

const receiptDate = document.getElementById("receiptDate");

const search = document.getElementById("search");
const barcodeStatus = document.getElementById("barcodeStatus");

const sellButton = document.getElementById("sellButton");

const paymentPanel = document.getElementById("paymentPanel");

const amountGiven = document.getElementById("amountGiven");
const paymentMethod = document.getElementById("paymentMethod");
const cardGiven = document.getElementById("cardGiven");
const splitPaymentFields = document.getElementById("splitPaymentFields");
const holdCartButton = document.getElementById("holdCartButton");
const resumeCartButton = document.getElementById("resumeCartButton");
const shiftButton = document.getElementById("shiftButton");

const changeAmount = document.getElementById("changeAmount");

const paymentError = document.getElementById("paymentError");
const checkoutConfirmModal = document.getElementById("checkoutConfirmModal");
const closeCheckoutConfirm = document.getElementById("closeCheckoutConfirm");
const cancelCheckoutConfirm = document.getElementById("cancelCheckoutConfirm");
const confirmCheckoutSale = document.getElementById("confirmCheckoutSale");
const checkoutConfirmItems = document.getElementById("checkoutConfirmItems");
const checkoutConfirmError = document.getElementById("checkoutConfirmError");

const productsSection = document.getElementById("products");

let productCards = [];
let measuredProduct = null;
let measuredEditId = null;
let measuredMode = "quantity";
let saleInProgress = false;
let measureReturnFocus = null;
const HELD_CARTS_KEY = "miniMartHeldCarts";
const SHIFT_STORAGE_KEY = "miniMartCurrentShift";
const CHECKOUT_DRAFT_KEY = "miniMartCheckoutDraft";
const CHECKOUT_DRAFT_VERSION = 1;
const CHECKOUT_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const draftStatus = document.getElementById("checkoutDraftStatus");
let draftSaveTimer = null;
let draftWriteFailed = false;
let restoringDraft = false;

const measureModal = document.getElementById("measureModal");
const measureValue = document.getElementById("measureValue");
const measureInputLabel = document.getElementById("measureInputLabel");
const measureInputPrefix = document.getElementById("measureInputPrefix");
const measureInputUnit = document.getElementById("measureInputUnit");
const measureProductSummary = document.getElementById("measureProductSummary");
const measureStock = document.getElementById("measureStock");
const measureResultLabel = document.getElementById("measureResultLabel");
const measureResult = document.getElementById("measureResult");
const measureError = document.getElementById("measureError");
const measureWarning = document.getElementById("measureWarning");
const measureQuickPicks = document.getElementById("measureQuickPicks");
const addMeasuredToCart = document.getElementById("addMeasuredToCart");

function measuredUnit(unit) {
  return ["kg", "g", "L", "mL"].includes(
    window.miniMartDB.normalizeUnit(unit),
  );
}

// Only measured items can differ from price times quantity, such as P20 of rice.
function lineAmount(item) {
  return measuredUnit(item.unit) && item.lineTotal !== undefined
    ? Number(item.lineTotal)
    : Number(item.price) * Number(item.quantity);
}

function unitText(unit) {
  return window.miniMartDB.units()[unit]?.shortLabel || unit;
}

function parseMeasureValue(value) {
  const text = String(value || "").trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    return null;
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function floorQuantity(value, unit) {
  const decimals = window.miniMartDB.unitDecimals(unit);
  const scale = 10 ** decimals;
  return Math.floor((value + Number.EPSILON) * scale) / scale;
}

function closeMeasureModal() {
  measureModal.hidden = true;
  measuredProduct = null;
  measuredEditId = null;
  measureValue.value = "";
  measureReturnFocus?.focus();
  measureReturnFocus = null;
}

function setMeasureMode(mode) {
  measuredMode = mode;
  document.querySelectorAll("[data-measure-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.measureMode === mode);
  });
  measureInputLabel.textContent = mode === "amount" ? "Amount" : "Quantity";
  measureInputPrefix.textContent = mode === "amount" ? "₱" : "";
  measureInputUnit.textContent =
    mode === "amount" ? "" : unitText(measuredProduct?.unit);
  measureResultLabel.textContent =
    mode === "amount" ? "Quantity" : "Price";
  measureQuickPicks.innerHTML = (mode === "amount"
    ? [10, 20, 50, 100].map((value) => ({ label: peso(value), value }))
    : [0.25, 0.5, 0.75, 1].map((value) => ({
        label: window.miniMartDB.formatQuantity(value, measuredProduct.unit),
        value,
      })))
    .map(
      (pick) =>
        `<button type="button" data-measure-pick="${pick.value}">${pick.label}</button>`,
    )
    .join("");
  updateMeasuredPreview();
}

function updateMeasuredPreview() {
  if (!measuredProduct) return;

  const unit = measuredProduct.unit;
  const decimals = window.miniMartDB.unitDecimals(unit);
  const inputDecimals = measuredMode === "amount" ? 2 : decimals;
  const entered = parseMeasureValue(measureValue.value);
  let quantity = null;
  let lineTotal = 0;
  let error = "";
  measureWarning.hidden = true;
  measureWarning.textContent = "";

  if (entered === null && measureValue.value.trim()) {
    error = "Enter a valid number using digits, a comma, or a dot.";
  } else if (entered !== null) {
    const decimalPart = String(measureValue.value).replace(",", ".").split(".")[1] || "";
    if (decimalPart.length > inputDecimals) {
      error = `This input allows up to ${inputDecimals} decimal places.`;
    } else if (entered <= 0) {
      error = "Enter an amount greater than zero.";
    } else if (measuredMode === "amount" && Number(measuredProduct.price) <= 0) {
      error = "This product needs a price before it can be sold by amount.";
    } else if (measuredMode === "amount") {
      quantity = floorQuantity(entered / Number(measuredProduct.price), unit);
      lineTotal = window.miniMartDB.roundMoney(entered);
      if (quantity <= 0) error = "That amount is too small for one unit.";
    } else {
      quantity = window.miniMartDB.roundQuantity(entered, unit);
      lineTotal = window.miniMartDB.roundMoney(quantity * measuredProduct.price);
    }
  }

  const alreadyInCart = measuredEditId ? 0 : Number(cart.get(measuredProduct.id)?.quantity || 0);
  const availableStock = window.miniMartDB.roundQuantity(
    Math.max(0, Number(measuredProduct.stock) - alreadyInCart), unit,
  );
  if (!error && quantity !== null && quantity > availableStock) {
    const blocking =
      window.miniMartSettings.get().blockOutOfStockSales !== false;
    if (blocking) {
      error = `Only ${window.miniMartDB.formatQuantity(availableStock, unit)} left to add.`;
    } else {
      measureWarning.hidden = false;
      measureWarning.textContent = "Warning: this quantity is above available stock.";
    }
  }

  measureError.hidden = !error;
  measureError.textContent = error;
  addMeasuredToCart.disabled = Boolean(error) || quantity === null;

  if (quantity !== null) {
    measureResult.textContent =
      measuredMode === "amount"
        ? window.miniMartDB.formatQuantity(quantity, unit)
        : peso(lineTotal);
  } else {
    measureResult.textContent = peso(0);
  }

  measureValue.setAttribute("aria-invalid", String(Boolean(error)));
}

function openMeasureModal(product, editId = null) {
  const unit = window.miniMartDB.normalizeUnit(product.unit);
  const stock = Number(product.stock) || 0;
  const blocking = window.miniMartSettings.get().blockOutOfStockSales !== false;
  if (blocking && stock <= 0) {
    showCheckoutToast("This product is out of stock and cannot be sold.");
    setBarcodeStatus(`${product.name}: no stock available.`, true);
    return false;
  }

  measuredProduct = { ...product, unit };
  measuredEditId = editId;
  measureReturnFocus = editId
    ? null
    : productCards.find((card) => card.dataset.productId === product.id);
  measureProductSummary.textContent = `${product.name} — ${peso(product.price)} / ${unitText(unit)}`;
  measureStock.textContent = `${window.miniMartDB.formatQuantity(stock, unit)} left`;
  measureValue.value = editId && cart.get(editId)
    ? cart.get(editId).inputValue || cart.get(editId).quantity
    : "";
  setMeasureMode(editId && cart.get(editId)?.amountMode ? "amount" : "quantity");
  measureModal.hidden = false;
  measureValue.focus();
  return true;
}

function addMeasuredLine() {
  updateMeasuredPreview();
  if (addMeasuredToCart.disabled || !measuredProduct) return;

  const unit = measuredProduct.unit;
  const entered = parseMeasureValue(measureValue.value);
  const quantity =
    measuredMode === "amount"
      ? floorQuantity(entered / Number(measuredProduct.price), unit)
      : window.miniMartDB.roundQuantity(entered, unit);
  const lineTotal = window.miniMartDB.roundMoney(
    measuredMode === "amount" ? entered : quantity * measuredProduct.price,
  );
  const existing = measuredEditId ? cart.get(measuredEditId) : cart.get(measuredProduct.id);
  const item = existing && !measuredEditId ? { ...existing } : {
    productId: measuredProduct.id,
    name: measuredProduct.name,
    price: Number(measuredProduct.price),
    quantity: 0,
    unit,
    lineTotal: 0,
  };

  if (measuredEditId) {
    item.quantity = quantity;
    item.lineTotal = lineTotal;
  } else {
    item.quantity = window.miniMartDB.roundQuantity(item.quantity + quantity, unit);
    item.lineTotal = window.miniMartDB.roundMoney(item.lineTotal + lineTotal);
  }
  item.unit = unit;
  // A line built from several additions keeps its running total, not the last entry.
  item.amountMode = measuredMode === "amount" || (!measuredEditId && Boolean(item.amountMode));
  item.inputValue = String(item.amountMode ? item.lineTotal : item.quantity);
  if (measuredEditId) cart.delete(measuredEditId);
  cart.set(item.productId, item);
  closeMeasureModal();
  renderCart();
}

/* =========================================================
   SUKI REWARD RULES
========================================================= */

const sukiStore = window.miniMartSukiStore;

const SUKI_STORAGE_KEY = sukiStore.STORAGE_KEY;

const sukiRules = window.miniMartSukiRules;

let selectedSukiId = "";

function showCheckoutToast(message, type = "error") {
  const toast = document.createElement("div");

  toast.className = `checkout-toast checkout-toast-${type}`;

  toast.setAttribute("role", "status");

  toast.textContent = message;

  document.body.append(toast);

  setTimeout(() => toast.remove(), 4000);
}

function setDraftStatus(message, isError = false) {
  if (!draftStatus) return;
  draftStatus.textContent = message;
  draftStatus.classList.toggle("is-error", isError);
}

function draftSnapshot() {
  return {
    version: CHECKOUT_DRAFT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [...cart.values()].map((item) => ({
      productId: item.productId,
      name: item.name,
      priceAtSave: Number(item.price),
      quantity: item.quantity,
      lineTotal: item.lineTotal,
      unit: item.unit || "piece",
      amountMode: Boolean(item.amountMode),
      inputValue: item.inputValue ?? "",
    })),
    selectedSukiId,
    rewardAmount: document.getElementById("rewardAmount")?.value || "0",
    paymentMethod: paymentMethod.value,
    amountGiven: amountGiven.value,
    cardGiven: cardGiven.value,
  };
}

function saveCheckoutDraft() {
  draftSaveTimer = null;
  if (restoringDraft) return true;
  if (!cart.size) {
    const result = safeWrite(CHECKOUT_DRAFT_KEY, null, { remove: true });
    draftWriteFailed = !result.ok;
    if (result.ok) setDraftStatus("");
    else {
      setDraftStatus("Could not save draft", true);
      showStorageError(storageErrorMessage(result));
    }
    return result.ok;
  }
  setDraftStatus("Saving...");
  const result = safeWrite(CHECKOUT_DRAFT_KEY, draftSnapshot());
  draftWriteFailed = !result.ok;
  if (result.ok) setDraftStatus("Draft saved");
  else {
    setDraftStatus("Could not save draft", true);
    showStorageError(storageErrorMessage(result));
  }
  return result.ok;
}

function scheduleCheckoutDraftSave() {
  if (draftSaveTimer) window.clearTimeout(draftSaveTimer);
  setDraftStatus("Saving...");
  draftSaveTimer = window.setTimeout(saveCheckoutDraft, 300);
}

function clearCheckoutDraft() {
  if (draftSaveTimer) window.clearTimeout(draftSaveTimer);
  draftSaveTimer = null;
  const result = safeWrite(CHECKOUT_DRAFT_KEY, null, { remove: true });
  draftWriteFailed = !result.ok;
  if (!result.ok) {
    setDraftStatus("Could not save draft", true);
    showStorageError(storageErrorMessage(result));
  } else {
    setDraftStatus("");
  }
  return result.ok;
}

function validDraft(value) {
  return value?.version === CHECKOUT_DRAFT_VERSION &&
    typeof value.updatedAt === "string" &&
    Array.isArray(value.items) &&
    value.items.every((item) =>
      item && typeof item.name === "string" &&
      Number.isFinite(Number(item.quantity)) &&
      Number(item.quantity) > 0 &&
      typeof item.unit === "string" &&
      typeof item.amountMode === "boolean",
    );
}

function restoreCheckoutDraft() {
  const result = window.miniMartDB.readStorage(CHECKOUT_DRAFT_KEY, null, validDraft);
  if (result.status === "missing") return;
  if (result.status !== "ok") {
    cart.clear();
    return;
  }
  const updatedAt = new Date(result.value.updatedAt).getTime();
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > CHECKOUT_DRAFT_MAX_AGE_MS) {
    clearCheckoutDraft();
    return;
  }

  const products = window.miniMartDB.products();
  let adjusted = 0;
  restoringDraft = true;
  result.value.items.forEach((saved) => {
    const product = products.find((entry) => (saved.productId ? entry.id === saved.productId : entry.name === saved.name));
    if (!product) {
      adjusted += 1;
      return;
    }
    const unit = window.miniMartDB.normalizeUnit(product.unit);
    const stock = Math.max(0, Number(product.stock) || 0);
    let quantity;
    let inputValue = saved.inputValue;
    if (saved.amountMode) {
      // Older drafts have no lineTotal, and their quantity may not match inputValue.
      const exact = saved.lineTotal !== undefined;
      const amount = exact ? Number(saved.lineTotal) : parseMeasureValue(saved.inputValue);
      const samePrice = Number(product.price) === Number(saved.priceAtSave);
      if (amount === null || Number(product.price) <= 0) quantity = 0;
      else if (exact && samePrice) quantity = window.miniMartDB.roundQuantity(Number(saved.quantity), unit);
      else quantity = floorQuantity(amount / Number(product.price), unit);
      inputValue = amount === null ? "" : String(amount);
    } else {
      quantity = window.miniMartDB.roundQuantity(Number(saved.quantity), unit);
    }
    const clamped = Math.min(quantity, stock);
    if (
      clamped <= 0 ||
      clamped !== quantity ||
      unit !== saved.unit ||
      Number(product.price) !== Number(saved.priceAtSave)
    ) adjusted += 1;
    if (clamped <= 0) {
      return;
    }
    cart.set(product.id, {
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: clamped,
      unit,
      amountMode: Boolean(saved.amountMode),
      inputValue,
      lineTotal: window.miniMartDB.roundMoney(
        saved.amountMode && clamped === quantity
          ? Number(inputValue || 0)
          : clamped * Number(product.price),
      ),
    });
  });
  selectedSukiId = typeof result.value.selectedSukiId === "string"
    ? result.value.selectedSukiId
    : "";
  const rewardInput = document.getElementById("rewardAmount");
  if (rewardInput) rewardInput.value = result.value.rewardAmount || "0";
  amountGiven.value = result.value.amountGiven || "";
  cardGiven.value = result.value.cardGiven || "0";
  paymentMethod.value = ["cash", "card", "gcash", "split"].includes(result.value.paymentMethod)
    ? result.value.paymentMethod
    : "cash";
  updatePaymentMethodUI();
  restoringDraft = false;
  if (adjusted) showCheckoutToast(`${adjusted} item${adjusted === 1 ? "" : "s"} were adjusted because stock or prices changed.`, "error");
}

window.showNfcToast = showCheckoutToast;

/* =========================================================
   SUKI CHECKOUT UI
========================================================= */

function createSukiCheckoutUI() {
  if (
    window.miniMartSettings.get().sukiEnabled === false ||
    document.getElementById("checkoutSukiPanel")
  ) {
    return;
  }

  const panel = document.createElement("div");

  panel.id = "checkoutSukiPanel";

  panel.style.margin = "12px 0";

  panel.innerHTML = `
    <div class="checkout-suki-heading">
      Suki Rewards
    </div>

    <button
      id="checkoutSukiScanButton"
      class="checkout-suki-scan-button"
      type="button"
    >
      Tap Suki's Card
    </button>

    <small
      id="checkoutSukiScanStatus"
      class="checkout-suki-scan-status"
      role="status"
      aria-live="polite"
    >
      Tap the customer's NFC card to apply rewards.
    </small>

    <button
      id="checkoutUsbCancel"
      class="checkout-secondary-button"
      type="button"
      hidden
    >
      Cancel
    </button>

    <div id="checkoutUsbUnknown" hidden>
      <strong>Card not registered</strong>
      <select id="checkoutUsbCustomer" aria-label="Attach it to"></select>
      <button id="checkoutUsbAttach" class="checkout-secondary-button" type="button">
        Attach to customer
      </button>
    </div>

    <div
      id="checkoutSukiInfo"
      style="margin-top:8px;font-size:.9rem;"
    ></div>

    <div
      id="checkoutRewardControls"
      hidden
      style="margin-top:8px;"
    >
      <label
        for="rewardAmount"
        style="display:block;margin-bottom:6px;"
      >
        Reward amount to use
      </label>

      <input
        id="rewardAmount"
        type="number"
        min="0"
        step="0.01"
        value="0"
        placeholder="0.00"
        style="width:100%;padding:10px;border-radius:8px;"
      />

      <small>
        Minimum ${sukiRules.settings().minPointsToRedeem} points. Maximum redeemable value is shown above.
      </small>
    </div>
  `;

  paymentPanel.prepend(panel);

  const scanButton = document.getElementById("checkoutSukiScanButton");

  const rewardInput = document.getElementById("rewardAmount");

  scanButton.addEventListener("click", scanSukiCard);
  if (!window.isNfcSupported()) window.miniMartCardReader.onStatus(showReaderStatus);

  rewardInput.addEventListener("input", updatePayment);

  refreshSukiSelector();
}

function refreshSukiSelector() {
  const sukis = sukiStore.read();

  const current = selectedSukiId;

  if (current && sukis.some((suki) => suki.id === current && suki.active)) {
    updateSukiCheckoutInfo();
  } else {
    selectedSukiId = "";
    scheduleCheckoutDraftSave();
    updateSukiCheckoutInfo();
  }
  scheduleCheckoutDraftSave();
}

// On a browser without Web NFC the button asks the cashier to tap the USB reader.
async function armUsbCheckout() {
  const scanButton = document.getElementById("checkoutSukiScanButton");
  const scanStatus = document.getElementById("checkoutSukiScanStatus");
  const cancelButton = document.getElementById("checkoutUsbCancel");
  const reader = window.miniMartCardReader;
  document.getElementById("checkoutUsbUnknown").hidden = true;
  scanButton.disabled = true;
  scanButton.textContent = "Waiting...";
  scanStatus.textContent = "Waiting for a card. Tap it on the reader now.";
  cancelButton.hidden = false;
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    reader.cancelCapture();
  };
  cancelButton.addEventListener("click", cancel, { once: true });
  const code = await reader.arm();
  cancelButton.removeEventListener("click", cancel);
  cancelButton.hidden = true;
  scanButton.disabled = false;
  scanButton.textContent = "Tap Suki's Card";
  if (!code) {
    scanStatus.textContent = cancelled ? "Cancelled." : "No card was read. Press the button to try again.";
    return;
  }
  const suki = sukiStore.findByCardCode(code);
  if (suki) selectCardCustomer(suki);
  else showUnknownCheckoutCard(code);
}

function showUnknownCheckoutCard(code) {
  const customers = document.getElementById("checkoutUsbCustomer");
  customers.replaceChildren(
    ...sukiStore.read()
      .filter((suki) => !suki.cardCode)
      .sort((first, second) => first.name.localeCompare(second.name))
      .map((suki) => new Option(suki.name, suki.id)),
  );
  document.getElementById("checkoutUsbAttach").onclick = () => {
    if (!sukiStore.setCardCode(customers.value, code).ok) return;
    document.getElementById("checkoutUsbUnknown").hidden = true;
    selectCardCustomer(sukiStore.findByCardCode(code));
  };
  document.getElementById("checkoutSukiScanStatus").textContent = `Card ${code}`;
  document.getElementById("checkoutUsbUnknown").hidden = false;
}

function selectCardCustomer(suki) {
  selectedSukiId = suki.id;
  scheduleCheckoutDraftSave();
  updateSukiCheckoutInfo();
  updatePayment();
  const scanButton = document.getElementById("checkoutSukiScanButton");
  const scanStatus = document.getElementById("checkoutSukiScanStatus");
  if (scanButton) {
    scanButton.disabled = false;
    scanButton.textContent = "Suki Card Selected";
  }
  if (scanStatus) {
    scanStatus.textContent = `${suki.name} selected.`;
    scanStatus.classList.remove("is-error");
  }
}

async function scanSukiCard() {
  if (!window.isNfcSupported()) {
    armUsbCheckout();
    return;
  }

  const scanButton = document.getElementById("checkoutSukiScanButton");

  const scanStatus = document.getElementById("checkoutSukiScanStatus");

  if (scanButton) {
    scanButton.disabled = true;

    scanButton.textContent = "Scanning...";
  }

  if (scanStatus) {
    scanStatus.textContent = "Hold the Suki card near the back of your phone.";
    scanStatus.classList.remove("is-error");
  }

  await scanNfcCard(
    (nfcId) => {
      const suki = sukiStore.read().find((entry) => entry.nfcId === nfcId);

      if (!suki) {
        selectedSukiId = "";
        scheduleCheckoutDraftSave();

        if (scanButton) {
          scanButton.disabled = false;

          scanButton.textContent = "Tap Suki's Card";
        }

        if (scanStatus) {
          scanStatus.textContent = "No Suki found for this card.";

          scanStatus.classList.add("is-error");
        }

        showCheckoutToast("No Suki found for this card.");

        updateSukiCheckoutInfo();
        updatePayment();

        return;
      }

      if (!suki.id || !suki.name) {
        selectedSukiId = "";

        if (scanButton) {
          scanButton.disabled = false;

          scanButton.textContent = "Tap Suki's Card";
        }

        if (scanStatus) {
          scanStatus.textContent =
            "This card can't be used right now. Please ask the manager to check the Suki account.";

          scanStatus.classList.add("is-error");
        }

        showCheckoutToast(
          "This card can't be used right now. Please ask the manager to check the Suki account.",
        );

        updateSukiCheckoutInfo();
        updatePayment();

        return;
      }

      selectedSukiId = suki.id;
      scheduleCheckoutDraftSave();

      updateSukiCheckoutInfo();
      updatePayment();

      if (scanButton) {
        scanButton.disabled = false;

        scanButton.textContent = "Suki Card Selected";
      }

      if (scanStatus) {
        scanStatus.textContent = "Suki card detected.";
      }
    },
    (message) => {
      if (scanButton) {
        scanButton.disabled = false;

        scanButton.textContent = "Tap Suki's Card";
      }

      if (scanStatus) {
        scanStatus.textContent = message;

        scanStatus.classList.add("is-error");
      }
    },
  );
}

// A USB card does what a phone tap does. At Checkout only a registered card gets here:
// any other code is a barcode.
window.miniMartCardReader.onCard((code, suki) => {
  if (suki && document.getElementById("checkoutSukiInfo")) selectCardCustomer(suki);
});

function showReaderStatus({ title, help }) {
  const scanStatus = document.getElementById("checkoutSukiScanStatus");
  if (selectedSukiId || !document.getElementById("checkoutUsbCancel").hidden) return;
  scanStatus.textContent = `${title}. ${help}`;
}

function transactionNumber() {
  const date = new Date();
  const stamp = date.toISOString().replace(/\D/g, "").slice(0, 14);
  return `TX-${stamp}-${Math.floor(Math.random() * 900 + 100)}`;
}

function getCurrentShift() {
  return window.miniMartDB.readStorage(SHIFT_STORAGE_KEY, null).value;
}

function ensureCurrentShift() {
  let shift = getCurrentShift();
  if (!shift) {
    shift = {
      id: `SHIFT-${Date.now()}`,
      openedAt: new Date().toISOString(),
      openingCash: 0,
      sales: 0,
      cashSales: 0,
    };
    const result = safeWrite(SHIFT_STORAGE_KEY, shift);
    if (!result.ok) {
      showStorageError(storageErrorMessage(result));
      return null;
    }
    updateShiftButton();
    showCheckoutToast("A new shift was opened with ₱0.00 opening cash.", "success");
  }
  return shift;
}

function updateShiftButton() {
  shiftButton.textContent = getCurrentShift() ? "CLOSE SHIFT" : "OPEN SHIFT";
}

function manageShift() {
  const current = getCurrentShift();
  if (!current) {
    const openingCash = Number(window.prompt("Opening cash amount", "0"));
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      showCheckoutToast("Enter a valid opening cash amount.");
      return;
    }
    const result = safeWrite(SHIFT_STORAGE_KEY, {
      id: `SHIFT-${Date.now()}`,
      openedAt: new Date().toISOString(),
      openingCash,
      sales: 0,
      cashSales: 0,
    });
    if (!result.ok) {
      showStorageError(storageErrorMessage(result));
      return;
    }
    updateShiftButton();
    showCheckoutToast("Shift opened.", "success");
    return;
  }
  if (cart.size) {
    showCheckoutToast("Hold or complete the current cart before closing the shift.");
    return;
  }
  const closingCash = Number(window.prompt(
    `Expected cash: ${peso(Number(current.openingCash) + Number(current.cashSales || 0))}\nEnter counted closing cash`,
    "",
  ));
  if (!Number.isFinite(closingCash) || closingCash < 0) {
    showCheckoutToast("Enter a valid closing cash amount.");
    return;
  }
  const expectedCash = Number(current.openingCash) + Number(current.cashSales || 0);
  const history = window.miniMartDB.readStorage(
    "miniMartShiftHistory",
    [],
    (value) => Array.isArray(value),
  ).value;
  history.unshift({
    ...current,
    closedAt: new Date().toISOString(),
    closingCash,
    expectedCash,
    variance: window.miniMartDB.roundMoney(closingCash - expectedCash),
  });
  const historyResult = safeWrite("miniMartShiftHistory", history.slice(0, 50));
  if (!historyResult.ok) {
    showStorageError(storageErrorMessage(historyResult));
    return;
  }
  const removeResult = safeWrite(SHIFT_STORAGE_KEY, null, { remove: true });
  if (!removeResult.ok) {
    showStorageError(storageErrorMessage(removeResult));
    return;
  }
  updateShiftButton();
  showCheckoutToast(`Shift closed. Variance: ${peso(closingCash - expectedCash)}.`, "success");
}

// The reward a sale will really use. The payment panel, the confirmation
// screen and the sale all read it from here, so they cannot disagree.
function appliedReward(total, suki = getSelectedSuki()) {
  const requested = Number(document.getElementById("rewardAmount")?.value || 0);
  if (!suki || !Number.isFinite(requested) || requested < 0) return 0;
  const points = sukiRules.usablePoints(suki);
  if (!sukiRules.canRedeem(points)) return 0;
  return window.miniMartDB.roundMoney(
    Math.min(requested, sukiRules.maxRedeemAmount(points, total)),
  );
}

function getSelectedSuki() {
  if (!selectedSukiId) {
    return null;
  }

  return sukiStore.read().find((suki) => suki.id === selectedSukiId) || null;
}

function updateSukiCheckoutInfo() {
  const info = document.getElementById("checkoutSukiInfo");

  const controls = document.getElementById("checkoutRewardControls");

  const rewardInput = document.getElementById("rewardAmount");

  if (!info || !controls) {
    return;
  }

  const suki = getSelectedSuki();

  if (!suki) {
    info.textContent = "No Suki customer selected.";

    controls.hidden = true;

    if (rewardInput) {
      rewardInput.value = "0";
    }

    return;
  }

  info.innerHTML = `
    <strong>
      ${escapeHtml(suki.name)}
    </strong>
    <br>
    Stamps:
    ${sukiRules.displayPoints(suki)}/${sukiRules.maxPoints()} points
    <br>
    Reward balance:
    ${window.miniMartSettings.formatCurrency(
      sukiRules.balance(suki),
    )}
  `;

  const usablePoints = sukiRules.usablePoints(suki);
  const redeemable = sukiRules.canRedeem(usablePoints) &&
    sukiRules.maxRedeemAmount(usablePoints, getSaleAmounts().total) > 0;
  controls.hidden = !redeemable;

  if (!redeemable) {
    if (rewardInput) {
      rewardInput.value = "0";
    }
  }
}

/* =========================================================
   PRODUCTS
========================================================= */

function renderProducts() {
  const products = window.miniMartDB.products();
  const favorites = new Set(
    window.miniMartDB.readStorage(
      "miniMartFavoriteProducts",
      [],
      (value) => Array.isArray(value),
    ).value,
  );

  const categories = [
    ...window.miniMartDB.categories(),
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

        const categoryIcon = `<img data-category-icon="${escapeHtml(category)}" alt="" />`;

        const header = `
          <div
            class="checkout-category"
            style="--accent:${safeAccent(first.accent)}"
            data-category="${escapeHtml(category)}"
            data-open="false"
            tabindex="0"
            role="button"
            aria-expanded="false"
          >
            <span class="category-toggle">
              ${categoryIcon}
            </span>

            <strong>${escapeHtml(category)}</strong>

            <small>
              ${categoryProducts.length}
              products
            </small>

            <b>＋</b>
          </div>
        `;

        const cards = categoryProducts
          .map(
            (product) =>
              `
                <article
                  class="product"
                  style="--accent:${safeAccent(product.accent)}"
                  data-category="${escapeHtml(product.category)}"
                  data-name="${escapeHtml(product.name)}"
                  data-product-id="${escapeHtml(product.id)}"
                  data-barcode="${escapeHtml(product.barcode || "")}"
                  data-price="${product.price}"
                  data-stock="${product.stock}"
                  data-unit="${product.unit || "piece"}"
                  tabindex="0"
                  role="button"
                  aria-label="Add ${escapeHtml(product.name)} to cart"
                >
                  <div class="product-head">
                    <span class="product-icon">
                      <img
                        data-category-icon="${escapeHtml(product.category)}"
                        alt=""
                      />
                    </span>

                    <span class="category">
                      ${escapeHtml(product.category.toUpperCase())}
                    </span>
                  </div>

                  <h2>
                    ${escapeHtml(product.name)}
                    <button type="button" class="product-favorite${favorites.has(product.id) ? " is-favorite" : ""}" data-favorite="${escapeHtml(product.id)}" aria-label="${favorites.has(product.id) ? "Remove from" : "Add to"} favorites">★</button>
                  </h2>

                  <p class="price">
                    ${measuredUnit(product.unit)
                      ? `${peso(product.price)} / ${unitText(product.unit)}`
                      : peso(product.price)}
                  </p>

                  <span class="stock">
                    ${measuredUnit(product.unit)
                      ? `${window.miniMartDB.formatQuantity(product.stock, product.unit)} left`
                      : `${product.stock} left`}
                  </span>
                </article>
                `,
          )
          .join("");

        return header + cards;
      })
      .join("") +
    `
      <div
        class="empty-results"
        id="emptyResults"
      >
        No products found.
      </div>
    `;

  productsSection.querySelectorAll("[data-category-icon]").forEach((image) => {
    image.src = categoryIconPath(image.dataset.categoryIcon);
  });
  productCards = [...productsSection.querySelectorAll(".product")];

  const recentIds = window.miniMartDB.readStorage(
    "miniMartRecentProducts",
    [],
    (value) => Array.isArray(value),
  ).value;
  const recentProducts = recentIds
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean)
    .slice(0, 5);
  if (recentProducts.length) {
    const recentBar = document.createElement("div");
    recentBar.className = "checkout-recent-products";
    recentBar.innerHTML = `<span>RECENT</span>${recentProducts
      .map((product) => `<button type="button" data-recent-product="${escapeHtml(product.id)}">${escapeHtml(product.name)}</button>`)
      .join("")}`;
    productsSection.prepend(recentBar);
    recentBar.querySelectorAll("[data-recent-product]").forEach((button) => {
      button.addEventListener("click", () => {
        const product = products.find((entry) => entry.id === button.dataset.recentProduct);
        if (product) addProductToCart(product);
      });
    });
  }

  productCards.forEach((product) =>
    product.addEventListener("click", addToCart),
  );
  productsSection.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const current = new Set(
        window.miniMartDB.readStorage(
          "miniMartFavoriteProducts",
          [],
          (value) => Array.isArray(value),
        ).value,
      );
      if (current.has(button.dataset.favorite)) {
        current.delete(button.dataset.favorite);
      } else {
        current.add(button.dataset.favorite);
      }
      const result = safeWrite("miniMartFavoriteProducts", [...current]);
      if (!result.ok) {
        showStorageError(storageErrorMessage(result));
        return;
      }
      button.classList.toggle("is-favorite", current.has(button.dataset.favorite));
    });
  });
  productCards.forEach((product) =>
    product.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      addToCart.call(product);
    }),
  );

  filterProducts();
}

function addToCart() {
  const product = window.miniMartDB.products().find((entry) => entry.id === this.dataset.productId);
  if (product) addProductToCart(product);
}

function addProductToCart(product) {
  if (measuredUnit(product.unit)) {
    return openMeasureModal(product) ? "measure" : false;
  }

  const name = product.name;
  const stock = Number(product.stock);
  const blockOutOfStockSales =
    window.miniMartSettings.get().blockOutOfStockSales !== false;

  const item = cart.get(product.id) || {
    productId: product.id,
    name,
    price: Number(product.price),
    quantity: 0,
  };

  if (blockOutOfStockSales && item.quantity >= stock) {
    showCheckoutToast(
      stock === 0
        ? "This product is out of stock and cannot be sold."
        : `Only ${stock} unit${stock === 1 ? "" : "s"} available.`,
    );
    setBarcodeStatus(`${name}: no more stock available for this cart.`, true);
    return false;
  }

  item.quantity += 1;

  cart.set(product.id, item);
  scheduleCheckoutDraftSave();
  const recent = window.miniMartDB.readStorage(
    "miniMartRecentProducts",
    [],
    (value) => Array.isArray(value),
  ).value
    .filter((entry) => entry !== product.id);
  recent.unshift(product.id);
  const recentResult = safeWrite("miniMartRecentProducts", recent.slice(0, 8));
  if (!recentResult.ok) showStorageError(storageErrorMessage(recentResult));

  renderCart();
  return "added";
}

function setBarcodeStatus(message, isError = false) {
  barcodeStatus.textContent = message;
  barcodeStatus.classList.toggle("is-error", isError);
}

function addScannedBarcode() {
  // Keep barcodes as strings so codes beginning with zero remain intact.
  const barcode = search.value.trim();
  if (!barcode) return;

  const matches = window.miniMartDB.products().filter((product) =>
    String(product.barcode || "").trim() === barcode,
  );

  if (matches.length !== 1) {
    setBarcodeStatus(matches.length > 1
      ? "This barcode belongs to multiple products. Correct it in Inventory."
      : "This barcode is not registered. Add it to a product in Inventory.", true);
    search.select();
    return;
  }

  const product = matches[0];
  const result = addProductToCart(product);
  if (!result) {
    search.select();
    return;
  }

  search.value = "";
  filterProducts();
  if (result === "measure") {
    measureReturnFocus = search;
    setBarcodeStatus(`Enter the quantity or amount for ${product.name}.`);
    return;
  }
  setBarcodeStatus(`Added ${product.name}. Quantity: ${cart.get(product.id).quantity}.`);
  search.focus({ preventScroll: true });
}

function filterProducts() {
  const rawQuery = search.value.trim();
  const query = rawQuery.toLowerCase();
  const matches = (product) =>
    product.dataset.name.toLowerCase().startsWith(query) ||
    (rawQuery !== "" && product.dataset.barcode === rawQuery);

  let visible = 0;

  const categoryGroups = [
    ...productsSection.querySelectorAll(".checkout-category"),
  ];

  categoryGroups.forEach((group, groupIndex) => {
    const categoryProducts = productCards
      .filter((product) => product.dataset.category === group.dataset.category)
      .sort((first, second) => {
        const firstName = first.dataset.name.toLowerCase();
        const secondName = second.dataset.name.toLowerCase();
        const firstStartsWithQuery =
          query && firstName.startsWith(query) ? 0 : 1;
        const secondStartsWithQuery =
          query && secondName.startsWith(query) ? 0 : 1;
        if (firstStartsWithQuery !== secondStartsWithQuery) {
          return firstStartsWithQuery - secondStartsWithQuery;
        }
        return firstName.localeCompare(secondName);
      });

    const nextGroup = categoryGroups[groupIndex + 1];
    categoryProducts.forEach((product) => {
      productsSection.insertBefore(product, nextGroup || null);
    });
  });

  productCards.forEach((product) => {
    const match = matches(product) ||
      product.dataset.name.toLowerCase().includes(query);

    const group = productsSection.querySelector(
      `.checkout-category[data-category="${CSS.escape(
        product.dataset.category,
      )}"]`,
    );

    const open = group?.dataset.open === "true" || query.length > 0;

    product.style.display = match && open ? "" : "none";

    if (match) {
      visible += 1;
    }

  });

  productsSection.querySelectorAll(".checkout-category").forEach((group) => {
    group.style.display = productCards.some(
      (product) =>
        product.dataset.category === group.dataset.category &&
        matches(product),
    )
      ? ""
      : "none";
  });

  document.getElementById("emptyResults").style.display = visible
    ? "none"
    : "block";
}

window.addEventListener("miniMartDatabaseChanged", (event) => {
  if (event.detail?.key !== "miniMartProducts") return;

  const currentProducts = new Map(
    window.miniMartDB.products().map((product) => [product.id, product]),
  );
  const removedCartItems = [...cart.keys()].filter(
    (id) => !currentProducts.has(id),
  );

  removedCartItems.forEach((id) => cart.delete(id));
  cart.forEach((item, id) => { item.name = currentProducts.get(id).name; });
  renderProducts();

  if (removedCartItems.length) {
    renderCart();
    showCheckoutToast(
      "The product list changed. Removed unavailable items from the cart.",
    );
  }
});

window.addEventListener("storage", (event) => {
  if (event.key !== SUKI_STORAGE_KEY) return;

  refreshSukiSelector();
  updatePayment();
});
window.addEventListener("miniMartSettingsChanged", () => {
  updateSukiCheckoutInfo();
  updatePayment();
});

/* =========================================================
   RECEIPT DATE
========================================================= */

receiptDate.textContent = new Intl.DateTimeFormat("en-US", {
timeZone: window.miniMartSettings.get().timezone,
month: "numeric",
day: "numeric",
year: "numeric",
hour: "numeric",
minute: "2-digit",
second: "2-digit",
}).format(new Date());

/* =========================================================
   PRODUCT EVENTS
========================================================= */

search.addEventListener("input", filterProducts);
search.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) addScannedBarcode();
  }
});

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

document.getElementById("closeMeasureModal").addEventListener("click", closeMeasureModal);
document.getElementById("cancelMeasureModal").addEventListener("click", closeMeasureModal);
measureModal.addEventListener("click", (event) => {
  if (event.target === measureModal) closeMeasureModal();
});
measureValue.addEventListener("input", updateMeasuredPreview);
addMeasuredToCart.addEventListener("click", addMeasuredLine);
document.querySelectorAll("[data-measure-mode]").forEach((button) => {
  button.addEventListener("click", () => setMeasureMode(button.dataset.measureMode));
});
measureQuickPicks.addEventListener("click", (event) => {
  const button = event.target.closest("[data-measure-pick]");
  if (!button) return;
  measureValue.value = button.dataset.measurePick;
  updateMeasuredPreview();
});
document.addEventListener("keydown", (event) => {
  if (measureModal.hidden) return;
  if (event.key === "Escape") {
    closeMeasureModal();
    return;
  }
  if (event.key === "Enter" && document.activeElement === measureValue) {
    event.preventDefault();
    addMeasuredLine();
  }
  if (event.key === "Tab") {
    const focusable = [...measureModal.querySelectorAll("button, input")].filter(
      (element) => !element.disabled,
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

/* =========================================================
   SELL / COMPLETE PURCHASE
========================================================= */

function openCheckoutConfirmation() {
  if (!cart.size) return;
  updatePayment();
  if (sellButton.disabled) return;
  const { subtotal, tax, total } = getSaleAmounts();
  const paid = Number(amountGiven.value);
  const card = Number(cardGiven.value);
  const received = paymentMethod.value === "split" ? paid + card : paid;
  const rewardUsed = appliedReward(total);
  const due = Math.max(total - rewardUsed, 0);
  checkoutConfirmItems.innerHTML = [...cart.values()]
    .map(
      (item) =>
        `<div class="checkout-confirm-item"><span>${escapeHtml(item.name)} <small>×${item.quantity}</small></span><strong>${peso(lineAmount(item))}</strong></div>`,
    )
    .join("");
  document.getElementById("confirmSubtotal").textContent = peso(subtotal);
  document.getElementById("confirmReward").textContent = peso(rewardUsed);
  document.getElementById("confirmCash").textContent = peso(received);
  document.getElementById("confirmChange").textContent = peso(Math.max(received - due, 0));
  document.getElementById("confirmDue").textContent = peso(due);
  checkoutConfirmError.hidden = true;
  checkoutConfirmModal.hidden = false;
  document.body.classList.add("modal-open");
  closeCheckoutConfirm.focus();
}

function closeCheckoutConfirmation() {
  checkoutConfirmModal.hidden = true;
  document.body.classList.remove("modal-open");
}

sellButton.addEventListener("click", openCheckoutConfirmation);
closeCheckoutConfirm.addEventListener("click", closeCheckoutConfirmation);
cancelCheckoutConfirm.addEventListener("click", closeCheckoutConfirmation);
checkoutConfirmModal.addEventListener("click", (event) => {
  if (event.target === checkoutConfirmModal) closeCheckoutConfirmation();
});

confirmCheckoutSale.addEventListener("click", () => {
  closeCheckoutConfirmation();
  completeSale();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !checkoutConfirmModal.hidden) {
    closeCheckoutConfirmation();
  }
});

function completeSale() {
  if (saleInProgress) return;
  saleInProgress = true;
  sellButton.disabled = true;

  const rollbackSnapshot = [
    "miniMartProducts",
    "miniMartSales",
    SUKI_STORAGE_KEY,
    SHIFT_STORAGE_KEY,
    "miniMartDeletedProducts",
    "miniMartInventoryAdjustments",
  ].map((key) => [key, window.miniMartDB.rawValue(key)]);

  const entries = [...cart.values()];

  const { total } = getSaleAmounts();

  const paid = Number(amountGiven.value);
  const card = Number(cardGiven.value);
  const received = paymentMethod.value === "split" ? paid + card : paid;

  const suki = getSelectedSuki();

  /*
   * IMPORTANT:
   * This is the only rewardInput
   * declaration needed in this
   * function.
   */
  const rewardInput = document.getElementById("rewardAmount");

  let rewardUsed = Number(rewardInput?.value || 0);
  if (!Number.isFinite(rewardUsed) || rewardUsed < 0) {
    rewardUsed = 0;
    if (rewardInput) rewardInput.value = "0";
  }

  if (!entries.length) {
    paymentError.hidden = false;
    paymentError.textContent = "Add at least one product before completing the sale.";
    updatePayment();
    saleInProgress = false;
    return;
  }

  if (
    amountGiven.value.trim() === "" ||
    !Number.isFinite(paid) ||
    paid < 0
  ) {
    paymentError.hidden = false;
    paymentError.textContent = "Enter a valid cash amount.";
    updatePayment();
    saleInProgress = false;
    return;
  }

  /*
   * Rewards can be redeemed once the
   * customer reaches the minimum set
   * in Settings.
   */
  const usablePoints = sukiRules.usablePoints(suki);
  if (suki) {
    if (!suki.active) {
      updatePayment();
      paymentError.hidden = false;
      paymentError.textContent = "This Suki customer is inactive.";
      saleInProgress = false;
      return;
    }

    if (!sukiRules.canRedeem(usablePoints)) {
      rewardUsed = 0;

      if (rewardInput) {
        rewardInput.value = "0";
      }
    }

  }

  rewardUsed = appliedReward(total, suki);
  const cashRequired = Math.max(total - rewardUsed, 0);
  const change = Math.max(received - cashRequired, 0);

  if (received < cashRequired) {
    paymentError.hidden = false;
    paymentError.textContent = `Need ${peso(cashRequired)} cash after rewards.`;
    updatePayment();
    saleInProgress = false;
    return;
  }

  const currentInventory = window.miniMartDB.products();
  if (window.miniMartSettings.get().blockOutOfStockSales !== false) {
    for (const item of entries) {
      const product = currentInventory.find((entry) => entry.id === item.productId);
      if (
        product &&
        Number(item.quantity) > Number(product.stock)
      ) {
        const unit = window.miniMartDB.normalizeUnit(product.unit);
        saleInProgress = false;
        updatePayment();
        paymentError.hidden = false;
        paymentError.textContent = `Only ${window.miniMartDB.formatQuantity(product.stock, unit)} of ${product.name} is available.`;
        return;
      }
    }
  }

  /* =========================================
       CALCULATE NEW STAMPS
    ========================================= */

  const cashGiven = paid;

  let stampsEarned = 0;

  if (suki && suki.active && usablePoints < sukiRules.maxPoints()) {
    stampsEarned = Math.min(
      sukiRules.pointsEarned(cashRequired),
      sukiRules.maxPoints() - usablePoints,
    );
  }

  /* =========================================
       UPDATE SUKI
    ========================================= */

  const saleId = transactionNumber();
  let sukiPoints = { sukiId: null, pointsEarned: 0, pointsSpent: 0 };

  if (suki && sukiStore.read().some((entry) => entry.id === suki.id)) {
    const pointsSpent = sukiRules.canRedeem(usablePoints) ? sukiRules.pointsForPesos(rewardUsed) : 0;
    const sukiResult = sukiStore.applyPointsChange(suki.id, {
      kind: "earn",
      points: stampsEarned,
      spent: pointsSpent,
      saleId,
      details: {
        description: `${entries.length} item${entries.length === 1 ? "" : "s"} purchased`,
        purchaseTotal: total,
        rewardUsed,
        cashGiven,
        cashRequired,
        change,
      },
    });
    if (!sukiResult.ok) {
      saleInProgress = false;
      updatePayment();
      showCheckoutToast("The sale could not be saved. Nothing was changed.");
      return;
    }
    sukiPoints = {
      sukiId: suki.id,
      pointsEarned: sukiResult.entry.stampsEarned,
      pointsSpent: sukiResult.entry.pointsSpent,
    };
  }

  /* =========================================
       INVENTORY
    ========================================= */

  const inventory = window.miniMartDB.products();

  entries.forEach((item) => {
    const product = inventory.find((entry) => entry.id === item.productId);

    if (product) {
      const unit = window.miniMartDB.normalizeUnit(product.unit);
      const nextStock = Number(product.stock) - Number(item.quantity);
      if (
        window.miniMartSettings.get().blockOutOfStockSales !== false &&
        nextStock < 0
      ) {
        product.stock = Number(product.stock);
        return;
      }
      product.stock = window.miniMartDB.roundQuantity(
        nextStock,
        unit,
      );
    }
  });

  const saleItems = entries.map((item) => {
    const product = inventory.find((entry) => entry.id === item.productId);

    return {
      name: item.name,

      price: item.price,

      quantity: item.quantity,

      productId: item.productId,

      category: product?.category || "Other",

      unit: window.miniMartDB.normalizeUnit(item.unit || product?.unit),

      lineTotal: window.miniMartDB.roundMoney(
        lineAmount(item),
      ),

      costPrice: window.miniMartDB.isKnownCost(product?.costPrice)
        ? Number(product.costPrice)
        : null,
    };
  });

  try {
    const productsResult = window.miniMartDB.saveProducts(inventory, {
      reason: "sale",
      reference: saleId,
    });
    if (!productsResult?.ok) throw productsResult.error;
    const shift = ensureCurrentShift();
    if (!shift) throw new Error("The shift could not be saved.");
    const saleResult = window.miniMartDB.recordSale(saleItems, total, {
      transactionNumber: saleId,
      paymentMethod: paymentMethod.value,
      payments: {
        cash: paid,
        card: paymentMethod.value === "card" ? paid : card,
        gcash: paymentMethod.value === "gcash" ? paid : 0,
      },
      shiftId: shift.id,
      cashGiven,
      cashRequired,
      change,
      rewardUsed,
      ...sukiPoints,
    });
    if (!saleResult?.ok) throw saleResult.error;
    shift.sales += 1;
    shift.cashSales += paid;
    const shiftResult = safeWrite(SHIFT_STORAGE_KEY, shift);
    if (!shiftResult.ok) throw shiftResult.error;
  } catch (error) {
    console.error("Sale could not be saved:", error);
    rollbackSnapshot.forEach(([key, raw]) => {
      safeWrite(key, raw, raw === null ? { remove: true } : { raw: true });
    });
    saleInProgress = false;
    renderProducts();
    updateShiftButton();
    updatePayment();
    showCheckoutToast("The sale could not be saved. Nothing was changed.");
    return;
  }

  /* =========================================
       RESET CHECKOUT
    ========================================= */

  cart.clear();

  amountGiven.value = "";
  cardGiven.value = "0";
  paymentMethod.value = "cash";
  updatePaymentMethodUI();
  clearCheckoutDraft();

  /*
   * FIX:
   * Do NOT declare rewardInput
   * again here.
   *
   * We use the rewardInput
   * declared at the beginning
   * of the SELL function.
   */
  if (rewardInput) {
    rewardInput.value = "0";
  }

  selectedSukiId = "";

  renderProducts();

  renderCart();

  refreshSukiSelector();
  saleInProgress = false;
  search.value = "";
  filterProducts();
  setBarcodeStatus("Sale complete. Ready to scan the next product.");
  search.focus({ preventScroll: true });
}

/* =========================================================
   PAYMENT CALCULATION
========================================================= */

function updatePayment() {
  const amounts = getSaleAmounts();
  const total = amounts.total;
  const method = paymentMethod.value;
  const paid = Number(amountGiven.value);
  const card = Number(cardGiven.value);
  const validCash = Number.isFinite(paid) && paid >= 0;
  const validCard = Number.isFinite(card) && card >= 0;
  const received = method === "split" ? paid + card : paid;
  const validPayment =
    amountGiven.value !== "" &&
    validCash &&
    validCard &&
    received >= 0;

  const suki = getSelectedSuki();

  const rewardInput = document.getElementById("rewardAmount");

  let rewardUsed = Number(rewardInput?.value || 0);
  if (!Number.isFinite(rewardUsed) || rewardUsed < 0) {
    rewardUsed = 0;
    if (rewardInput) rewardInput.value = "0";
  }

  /*
   * Rewards can be redeemed once the
   * customer reaches the minimum set
   * in Settings.
   */
  const usablePoints = sukiRules.usablePoints(suki);
  if (!suki || !sukiRules.canRedeem(usablePoints)) {
    rewardUsed = 0;

    if (rewardInput) {
      rewardInput.value = "0";
    }
  } else {
    rewardUsed = appliedReward(total, suki);

    if (rewardInput) {
      rewardInput.max = sukiRules.maxRedeemAmount(usablePoints, total);
    }
  }

  const cashRequired = Math.max(total - rewardUsed, 0);
  const change = validPayment ? Math.max(received - cashRequired, 0) : 0;

  changeAmount.innerHTML = peso(change);

  const insufficient = validPayment && received < cashRequired;
  const invalidPayment =
    amountGiven.value !== "" && (!validCash || !validCard);

  paymentError.hidden = !insufficient && !invalidPayment;

  if (insufficient) {
    paymentError.textContent = `Need ${peso(cashRequired)} cash after rewards.`;
  } else if (invalidPayment) {
    paymentError.textContent = "Enter a valid cash amount.";
  }

  sellButton.disabled =
    !cart.size || insufficient || invalidPayment || !validPayment;
  holdCartButton.disabled = !cart.size;
  scheduleCheckoutDraftSave();
}

amountGiven.addEventListener("input", updatePayment);
cardGiven.addEventListener("input", updatePayment);
paymentMethod.addEventListener("change", () => {
  updatePaymentMethodUI();
  updatePayment();
});

function updatePaymentMethodUI() {
  const isSplit = paymentMethod.value === "split";
  splitPaymentFields.hidden = !isSplit;
  if (!isSplit) cardGiven.value = "0";
  amountGiven.previousElementSibling.textContent =
    paymentMethod.value === "cash" || isSplit ? " ₱ " : " ₱ ";
}

/* =========================================================
   CART
========================================================= */

function getCartTotal() {
  return window.miniMartDB.roundMoney(
    [...cart.values()].reduce(
      (sum, item) => sum + lineAmount(item),
      0,
    ),
  );
}

function getSaleAmounts() {
  const subtotal = getCartTotal();
  return {
    subtotal,
    total: subtotal,
  };
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
        `
          <div class="cart-row" data-measured="${String(Boolean(item.unit && measuredUnit(item.unit)))}" data-edit="${escapeHtml(item.productId)}">
            <span>
              ${escapeHtml(item.name)}

              <small>
                ${item.unit && measuredUnit(item.unit)
                  ? `${window.miniMartDB.formatQuantity(item.quantity, item.unit)} x ${peso(item.price)}/${unitText(item.unit)}`
                  : `${item.quantity}`}
                ${item.unit && measuredUnit(item.unit) ? "" : " x"}
                ${item.unit && measuredUnit(item.unit) ? "" : peso(item.price)}
              </small>
            </span>

            <span>
              <strong>
                ${peso(lineAmount(item))}
              </strong>

              ${
                item.unit && measuredUnit(item.unit)
                  ? ""
                  : `
                    <span class="cart-quantity-controls" aria-label="Quantity for ${escapeHtml(item.name)}">
                      <button type="button" class="cart-quantity-button" data-decrement="${escapeHtml(item.productId)}" aria-label="Decrease ${escapeHtml(item.name)} quantity">−</button>
                      <span class="cart-quantity">${item.quantity}</span>
                      <button type="button" class="cart-quantity-button" data-increment="${escapeHtml(item.productId)}" aria-label="Increase ${escapeHtml(item.name)} quantity">+</button>
                    </span>
                  `
              }

              <button
                type="button"
                class="remove"
                data-remove="${escapeHtml(item.productId)}"
                aria-label="Remove ${escapeHtml(item.name)}"
              >
                x
              </button>
            </span>
          </div>
          `,
    )
    .join("");

  document.getElementById("totalAmount").innerHTML = peso(getSaleAmounts().total);

  updatePayment();

  cartItems.querySelectorAll("[data-increment]").forEach((button) =>
    button.addEventListener("click", () => {
      const item = cart.get(button.dataset.increment);
      if (!item) return;
      const product = window.miniMartDB.products().find(
        (entry) => entry.id === item.productId,
      );
      if (!product) return;

      const stock = Number(product.stock);
      if (
        window.miniMartSettings.get().blockOutOfStockSales !== false &&
        item.quantity >= stock
      ) {
        showCheckoutToast(
          stock <= 0
            ? "This product is out of stock."
            : `Only ${stock} unit${stock === 1 ? "" : "s"} available.`,
        );
        return;
      }

      item.quantity += 1;
      scheduleCheckoutDraftSave();
      renderCart();
    }),
  );

  cartItems.querySelectorAll("[data-decrement]").forEach((button) =>
    button.addEventListener("click", () => {
      const item = cart.get(button.dataset.decrement);
      if (!item) return;
      if (item.quantity <= 1) {
        cart.delete(item.productId);
      } else {
        item.quantity -= 1;
      }
      scheduleCheckoutDraftSave();
      renderCart();
    }),
  );

  cartItems.querySelectorAll("[data-remove]").forEach((button) =>
    button.addEventListener("click", () => {
      cart.delete(button.dataset.remove);
      scheduleCheckoutDraftSave();
      renderCart();
    }),
  );

  cartItems.querySelectorAll('[data-measured="true"]').forEach((row) =>
    row.addEventListener("click", (event) => {
      if (event.target.closest("[data-remove]")) return;
      const item = cart.get(row.dataset.edit);
      const product = window.miniMartDB.products().find(
        (entry) => entry.id === row.dataset.edit,
      );
      if (item && product) openMeasureModal(product, item.productId);
    }),
  );
}

function holdCurrentCart() {
  if (!cart.size) return;
  const held = window.miniMartDB.readStorage(
    HELD_CARTS_KEY,
    [],
    (value) => Array.isArray(value),
  ).value;
  held.unshift({
    id: `HOLD-${Date.now()}`,
    createdAt: new Date().toISOString(),
    items: [...cart.values()],
  });
  const result = safeWrite(HELD_CARTS_KEY, held.slice(0, 10));
  if (!result.ok) {
    showStorageError(storageErrorMessage(result));
    return;
  }
  cart.clear();
  if (!clearCheckoutDraft()) return;
  amountGiven.value = "";
  cardGiven.value = "0";
  renderCart();
  showCheckoutToast("Cart held. Use RESUME CART to restore it.", "success");
}

async function resumeHeldCart() {
  const held = window.miniMartDB.readStorage(
    HELD_CARTS_KEY,
    [],
    (value) => Array.isArray(value),
  ).value;
  if (!held.length) {
    showCheckoutToast("There are no held carts.");
    return;
  }
  if (cart.size && !(await confirmDialog({
    title: "Replace the current cart?",
    message: "The held cart will take its place, and the items in the current cart will be removed.",
    details: "To keep them, hold this cart first.",
    confirmLabel: "Replace cart",
    cancelLabel: "Keep current cart",
    tone: "danger",
  }))) {
    return;
  }
  const [next, ...remaining] = held;
  const result = safeWrite(HELD_CARTS_KEY, remaining);
  if (!result.ok) {
    showStorageError(storageErrorMessage(result));
    return;
  }
  cart.clear();
  const products = window.miniMartDB.products();
  next.items.forEach((item) => {
    const product = products.find((entry) => (item.productId ? entry.id === item.productId : entry.name === item.name));
    const productId = product?.id || item.productId || item.name;
    cart.set(productId, { ...item, productId, name: product?.name || item.name });
  });
  scheduleCheckoutDraftSave();
  renderCart();
  showCheckoutToast("Held cart restored.", "success");
}

holdCartButton.addEventListener("click", holdCurrentCart);
resumeCartButton.addEventListener("click", resumeHeldCart);
shiftButton.addEventListener("click", manageShift);
window.addEventListener("beforeunload", (event) => {
  if (!cart.size || !draftWriteFailed) return;
  event.preventDefault();
  event.returnValue = "";
});
window.addEventListener("pagehide", () => {
  if (cart.size) saveCheckoutDraft();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && cart.size) saveCheckoutDraft();
});
window.addEventListener("miniMartBeforeNavigate", () => {
  if (cart.size) saveCheckoutDraft();
});
window.addEventListener("storage", (event) => {
  if (event.key !== CHECKOUT_DRAFT_KEY || !event.newValue || event.newValue === JSON.stringify(draftSnapshot())) return;
  showCheckoutToast("Cart updated in another tab.", "success");
  cart.clear();
  restoreCheckoutDraft();
  renderCart();
});
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === "enter") {
    event.preventDefault();
    if (!sellButton.disabled) openCheckoutConfirmation();
  }
  if (event.key === "/" && document.activeElement !== search) {
    event.preventDefault();
    search.focus();
  }
});

/* =========================================================
   INITIALIZE
========================================================= */

createSukiCheckoutUI();

renderProducts();

restoreCheckoutDraft();
renderCart();

refreshSukiSelector();
updateShiftButton();

search.focus({ preventScroll: true });
window.miniMartInitialDataReady = true;
