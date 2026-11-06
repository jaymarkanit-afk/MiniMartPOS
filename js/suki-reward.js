"use strict";

/* =========================================================
   MINI MART - SUKI REWARDS + NFC
========================================================= */

const sukiRules = window.miniMartSukiRules;

const sukiStore = window.miniMartSukiStore;

let selectedSukiId = "";
let pendingNfcId = "";
let pendingCardCode = "";
let unknownCardCode = "";
let unlinkSukiId = "";
let selectedSukiFilter = "all";

const isNfcSupported = window.isNfcSupported;

const scanNfcCard = window.scanNfcCard;

/* =========================================================
   ELEMENTS
========================================================= */

const addSukiModal = document.getElementById("addSukiModal");

const addSukiForm = document.getElementById("addSukiForm");

const openAddSuki = document.getElementById("openAddSuki");

const closeAddSuki = document.getElementById("closeAddSuki");

const cancelAddSuki = document.getElementById("cancelAddSuki");

const linkNfcButton = document.getElementById("linkNfcButton");

const linkStatus = document.getElementById("linkStatus");

const sukiName = document.getElementById("sukiName");

const sukiPhone = document.getElementById("sukiPhone");

const sukiNameError = document.getElementById("sukiNameError");

const sukiPhoneError = document.getElementById("sukiPhoneError");

const saveSukiButton = document.getElementById("saveSukiButton");

const sukiJoined = document.getElementById("sukiJoined");

const sukiJoinedError = document.getElementById("sukiJoinedError");

const scanButton = document.getElementById("scanButton");

const scanTitle = document.getElementById("scanTitle");

const scanStatus = document.getElementById("scanStatus");

const scanTab = document.getElementById("scanTab");

const allSukisTab = document.getElementById("allSukisTab");

const scanView = document.getElementById("scanView");
const cardReader = window.miniMartCardReader;
const usbReaderState = document.getElementById("usbReaderState");
const usbScanCancel = document.getElementById("usbScanCancel");
const usbCardUnknown = document.getElementById("usbCardUnknown");
const usbUnknownCode = document.getElementById("usbUnknownCode");
const usbAttachCustomer = document.getElementById("usbAttachCustomer");
const usbAttachCard = document.getElementById("usbAttachCard");
const addUsbCardBox = document.getElementById("addUsbCardBox");
const addUsbCardScan = document.getElementById("addUsbCardScan");
const addUsbCardCancel = document.getElementById("addUsbCardCancel");
const addUsbCardStatus = document.getElementById("addUsbCardStatus");

const allSukisView = document.getElementById("allSukisView");

const sukiSearch = document.getElementById("sukiSearch");

const sukiList = document.getElementById("sukiList");

const detailModal = document.getElementById("detailModal");

const closeDetail = document.getElementById("closeDetail");

const detailTitle = document.getElementById("detailTitle");

const detailContent = document.getElementById("detailContent");

const deleteSukiModal = document.getElementById("deleteSukiModal");

const closeDeleteSuki = document.getElementById("closeDeleteSuki");

const cancelDeleteSuki = document.getElementById("cancelDeleteSuki");

const confirmDeleteSuki = document.getElementById("confirmDeleteSuki");

const deleteSukiCopy = document.getElementById("deleteSukiCopy");

const unlinkNfcModal = document.getElementById("unlinkNfcModal");

const closeUnlinkNfc = document.getElementById("closeUnlinkNfc");

const cancelUnlinkNfc = document.getElementById("cancelUnlinkNfc");

const confirmUnlinkNfc = document.getElementById("confirmUnlinkNfc");

const unlinkNfcCopy = document.getElementById("unlinkNfcCopy");
const sukiDisabledNotice = document.getElementById("sukiDisabledNotice");
const sukiContent = document.querySelector(".suki-content");

if (window.miniMartSettings?.get().sukiEnabled === false) {
  sukiDisabledNotice.hidden = false;
  sukiContent.hidden = true;
}
window.addEventListener("miniMartSettingsChanged", () => {
  const enabled = window.miniMartSettings.get().sukiEnabled !== false;
  sukiDisabledNotice.hidden = enabled;
  sukiContent.hidden = !enabled;
  renderSukiOverview();
  renderSukiList();
});

/* =========================================================
   UTILITY
========================================================= */

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function showSukiToast(message, type = "error") {
  const toast = document.createElement("div");

  toast.className = `suki-toast suki-toast-${type}`;

  toast.setAttribute("role", "status");

  toast.textContent = message;

  document.body.append(toast);

  setTimeout(() => toast.remove(), 4000);
}

window.showNfcToast = showSukiToast;

/* =========================================================
   MODALS
========================================================= */

function openModal(modal) {
  if (!modal) {
    return;
  }

  modal.hidden = false;

  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  if (!modal) {
    return;
  }

  modal.hidden = true;

  const allClosed =
    (!addSukiModal || addSukiModal.hidden) &&
    (!detailModal || detailModal.hidden) &&
    (!deleteSukiModal || deleteSukiModal.hidden) &&
    (!unlinkNfcModal || unlinkNfcModal.hidden);

  if (allClosed) {
    document.body.classList.remove("modal-open");
  }
}

function renderSukiOverview() {
  const sukis = sukiStore.read();
  const totalCustomers = document.getElementById("sukiTotalCustomers");
  const activeCards = document.getElementById("sukiActiveCards");
  const readyRewards = document.getElementById("sukiReadyRewards");
  const totalRewards = document.getElementById("sukiTotalRewards");

  if (!totalCustomers || !activeCards || !readyRewards || !totalRewards) {
    return;
  }

  totalCustomers.textContent = sukis.length;
  activeCards.textContent = sukis.filter((suki) => suki.active && suki.nfcId).length;
  readyRewards.textContent = sukis.filter(
    (suki) => suki.active && sukiRules.canRedeem(sukiRules.usablePoints(suki)) && sukiRules.balance(suki) > 0,
  ).length;
  totalRewards.textContent = peso(
    sukis.reduce((sum, suki) => sum + sukiRules.balance(suki), 0),
  );
}

/* =========================================================
   ADD SUKI
========================================================= */

function validateSukiFields() {
  const name = sukiName?.value.trim() || "";

  const phone = sukiPhone?.value.trim() || "";

  const validName =
    /^[\p{L}]+(?:[.'-][\p{L}]+)*\.?(?: +[\p{L}]+(?:[.'-][\p{L}]+)*\.?)*$/u.test(
      name,
    );

  const normalizedPhone =
    phone.length === 11 && phone.startsWith("09") ? phone.slice(1) : phone;

  if (sukiPhone && normalizedPhone !== phone) {
    sukiPhone.value = normalizedPhone;
  }

  const validPhone = normalizedPhone === "" || /^9\d{9}$/.test(normalizedPhone);

  if (sukiNameError) {
    sukiNameError.hidden = validName;
  }

  if (sukiPhoneError) {
    sukiPhoneError.hidden = validPhone;
  }

  sukiName?.setAttribute("aria-invalid", String(!validName));

  sukiPhone?.setAttribute("aria-invalid", String(!validPhone));

  if (saveSukiButton) {
    saveSukiButton.disabled = !validName || !validPhone;
  }

  return validName && validPhone;
}

// Waits for one tap on the USB reader, then passes the code on. A code that belongs to
// someone else is reported here, so onCode only gets a usable card.
async function captureUsbCard({ scanButton, cancelButton, status, ownerId = null, onCode }) {
  scanButton.disabled = true;
  cancelButton.hidden = false;
  status.textContent = "Tap the card on the reader now.";
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    cardReader.cancelCapture();
  };
  cancelButton.addEventListener("click", cancel, { once: true });
  const code = await cardReader.capture();
  cancelButton.removeEventListener("click", cancel);
  scanButton.disabled = false;
  cancelButton.hidden = true;
  if (!code) {
    status.textContent = cancelled ? "Cancelled." : "No card was read. Try again.";
    return;
  }
  const owner = sukiStore.findByCardCode(code);
  if (owner && owner.id !== ownerId) {
    status.textContent = `This card is already registered to ${owner.name}.`;
    return;
  }
  onCode(code);
}

function scanUsbCardForNewSuki() {
  captureUsbCard({
    scanButton: addUsbCardScan,
    cancelButton: addUsbCardCancel,
    status: addUsbCardStatus,
    onCode: (code) => {
      pendingCardCode = code;
      addUsbCardStatus.textContent = `Card ${code} will be saved with this customer.`;
    },
  });
}

function resetUsbCardForm() {
  cardReader.cancelCapture();
  pendingCardCode = "";
  addUsbCardStatus.textContent = "";
}

function openAddSukiForm() {
  if (!addSukiForm) {
    return;
  }

  addSukiForm.reset();

  pendingNfcId = "";
  resetUsbCardForm();

  if (sukiJoined) {
    sukiJoined.value = new Date().toISOString().split("T")[0];
  }

  if (linkStatus) {
    linkStatus.textContent = "No card linked.";
  }

  if (linkNfcButton) {
    linkNfcButton.disabled = false;

    linkNfcButton.textContent = "Tap Card";
  }

  if (sukiJoinedError) {
    sukiJoinedError.hidden = true;
  }

  validateSukiFields();

  openModal(addSukiModal);

  setTimeout(() => {
    sukiName?.focus();
  }, 100);
}

function closeAddSukiForm() {
  closeModal(addSukiModal);

  pendingNfcId = "";
  resetUsbCardForm();

  if (linkNfcButton) {
    linkNfcButton.disabled = false;

    linkNfcButton.textContent = "Tap Card";
  }
}

/* =========================================================
   LINK NFC
========================================================= */

async function linkNfcCard() {
  if (!isNfcSupported()) {
    scanUsbCardForNewSuki();

    return;
  }

  linkNfcButton.disabled = true;

  linkNfcButton.textContent = "Waiting...";

  if (linkStatus) {
    linkStatus.textContent = "Hold the NFC card near the back of your phone.";
  }

  await scanNfcCard((nfcId) => {
    const sukis = sukiStore.read();

    const existing = sukis.find((suki) => suki.nfcId === nfcId);

    if (existing) {
      pendingNfcId = "";

      linkStatus.textContent =
        "This card is already linked to an existing account.";

      linkNfcButton.disabled = false;

      linkNfcButton.textContent = "Tap Card";

      return;
    }

    pendingNfcId = nfcId;

    linkStatus.innerHTML = `
        <strong>
          ✓ NFC Card Detected
        </strong>
        <br>
        <small>
          Serial Number:
          ${escapeHtml(nfcId)}
        </small>
      `;

    linkNfcButton.disabled = false;

    linkNfcButton.textContent = "Card Linked";
  });
}

/* =========================================================
   SAVE NEW SUKI
========================================================= */

function saveSuki(event) {
  event.preventDefault();

  if (!validateSukiFields()) {
    return;
  }

  const name = sukiName?.value.trim();

  const phoneInput = sukiPhone?.value.trim();

  const phone = phoneInput ? `+63${phoneInput}` : "";

  const joined = sukiJoined?.value;

  if (!name) {
    showSukiToast("Please enter the customer's name.");

    sukiName?.focus();

    return;
  }

  if (!joined) {
    if (sukiJoinedError) {
      sukiJoinedError.hidden = false;
    }

    sukiJoined?.focus();

    return;
  }

  const sukis = sukiStore.read();

  if (pendingNfcId) {
    const duplicate = sukis.find((suki) => suki.nfcId === pendingNfcId);

    if (duplicate) {
      showSukiToast("This card is already linked to an existing account.");

      return;
    }
  }

  const newSuki = {
    id: sukiStore.createId(),

    name,

    phone,

    joined,

    nfcId: pendingNfcId,

    ...(pendingCardCode ? { cardCode: pendingCardCode } : {}),

    stamps: 0,


    active: true,

    history: [],
  };

  sukis.push(newSuki);

  const result = sukiStore.save(sukis);
  if (!result.ok) return;

  pendingNfcId = "";

  closeAddSukiForm();

  renderSukiList();

  showSukiToast(`${name} has been added successfully.`, "success");
}

/* =========================================================
   SCAN EXISTING SUKI
========================================================= */

async function scanExistingSuki() {
  if (!isNfcSupported()) {
    armUsbScan();

    return;
  }

  if (scanButton) {
    scanButton.disabled = true;
  }

  if (scanTitle) {
    scanTitle.textContent = "Waiting for Card...";
  }

  if (scanStatus) {
    scanStatus.textContent = "Hold the Suki card near the back of your phone.";
  }

  await scanNfcCard((nfcId) => {
    const suki = sukiStore.read().find((entry) => entry.nfcId === nfcId);

    if (!suki) {
      if (scanTitle) {
        scanTitle.textContent = "Unknown Card";
      }

      if (scanStatus) {
        scanStatus.textContent = `NFC ID ${nfcId} is not linked to a Suki customer.`;
      }

      if (scanButton) {
        scanButton.disabled = false;
      }

      return;
    }

    if (!suki.id || !suki.name) {
      if (scanTitle) {
        scanTitle.textContent = "Suki Card Unavailable";
      }

      if (scanStatus) {
        scanStatus.textContent =
          "This card can't be used right now. Please ask the manager to check the Suki account.";
      }

      if (scanButton) {
        scanButton.disabled = false;
      }

      return;
    }

    showScannedSuki(suki);
  });

  if (scanButton) {
    scanButton.disabled = false;
  }
}

function showScannedSuki(suki) {
  if (scanTitle) {
    scanTitle.textContent = suki.name;
  }

  if (scanStatus) {
    scanStatus.textContent = `${sukiRules.displayPoints(suki)}/${sukiRules.maxPoints()} points • ${peso(
      sukiRules.balance(suki),
    )} reward`;
  }

  if (scanButton) {
    scanButton.disabled = false;
  }

  showSukiDetails(suki.id);
}

/* =========================================================
   USB CARD READER
========================================================= */

function showUnknownCard(code) {
  unknownCardCode = code;
  usbUnknownCode.textContent = `Card ${code}`;
  usbAttachCustomer.replaceChildren(
    ...sukiStore.read()
      .filter((suki) => !suki.cardCode)
      .sort((first, second) => first.name.localeCompare(second.name))
      .map((suki) => new Option(suki.name, suki.id)),
  );
  usbAttachCard.disabled = usbAttachCustomer.options.length === 0;
  usbCardUnknown.hidden = false;
  if (scanTitle) scanTitle.textContent = "Card not registered";
}

function attachUnknownCard() {
  const result = sukiStore.setCardCode(usbAttachCustomer.value, unknownCardCode);
  if (!result.ok) return;
  const suki = sukiStore.findByCardCode(unknownCardCode);
  usbCardUnknown.hidden = true;
  unknownCardCode = "";
  renderSukiList();
  showSukiToast(`Card attached to ${suki.name}.`, "success");
  showScannedSuki(suki);
}

function addUsbCardControls(suki) {
  const box = detailContent.querySelector("[data-usb-card-box]");
  if (!box || isNfcSupported()) return;
  detailContent.querySelector(".suki-nfc-actions")?.remove();
  const value = document.createElement("strong");
  value.textContent = suki.cardCode || "No USB card linked";
  const scan = document.createElement("button");
  scan.type = "button";
  scan.className = "secondary-button";
  scan.textContent = "Scan card with USB reader";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "secondary-button";
  cancel.textContent = "Cancel";
  cancel.hidden = true;
  const status = document.createElement("p");
  status.setAttribute("aria-live", "polite");
  scan.addEventListener("click", () => captureUsbCard({
    scanButton: scan,
    cancelButton: cancel,
    status,
    ownerId: suki.id,
    onCode: (code) => {
      if (sukiStore.setCardCode(suki.id, code).ok) showSukiDetails(suki.id);
    },
  }));
  box.append(value, scan, cancel, status);
}

// Only the Scan tab with nothing open over it is waiting for a card.
cardReader.setCardMode(() => Boolean(scanView && !scanView.hidden) &&
  addSukiModal?.hidden !== false &&
  detailModal?.hidden !== false &&
  deleteSukiModal?.hidden !== false &&
  unlinkNfcModal?.hidden !== false);

function handleCardTap(code, suki) {
  if (!suki) {
    showUnknownCard(code);
    return;
  }
  usbCardUnknown.hidden = true;
  showScannedSuki(suki);
}

cardReader.onCard((code, suki) => {
  if (addSukiModal && !addSukiModal.hidden) return;
  handleCardTap(code, suki);
});

// On a browser without Web NFC the icon asks the cashier to tap the USB reader.
async function armUsbScan() {
  scanButton.disabled = true;
  usbScanCancel.hidden = false;
  usbCardUnknown.hidden = true;
  scanTitle.textContent = "Waiting for a card. Tap it on the reader now.";
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    cardReader.cancelCapture();
  };
  usbScanCancel.addEventListener("click", cancel, { once: true });
  const code = await cardReader.arm();
  usbScanCancel.removeEventListener("click", cancel);
  usbScanCancel.hidden = true;
  scanButton.disabled = false;
  if (code) {
    handleCardTap(code, sukiStore.findByCardCode(code));
    return;
  }
  scanTitle.textContent = "Waiting for a card";
  scanStatus.textContent = cancelled ? "Cancelled." : "No card was read. Press the icon to try again.";
}

if (!isNfcSupported()) {
  usbReaderState.hidden = false;
  addUsbCardBox.hidden = false;
  scanTitle.textContent = "Waiting for a card";
  scanStatus.textContent = "";
  document.querySelector(".scan-copy")?.replaceChildren("A USB reader types the card number for you.");
  cardReader.onStatus(({ working, title, help }) => {
    usbReaderState.classList.toggle("is-working", working);
    document.getElementById("usbReaderStateTitle").textContent = title;
    document.getElementById("usbReaderStateHelp").textContent = help;
  });
}

addUsbCardScan.addEventListener("click", scanUsbCardForNewSuki);
usbAttachCard.addEventListener("click", attachUnknownCard);

/* =========================================================
   TABS
========================================================= */

function showScanTab() {
  if (scanTab) {
    scanTab.classList.add("is-active");

    scanTab.setAttribute("aria-selected", "true");
  }

  if (allSukisTab) {
    allSukisTab.classList.remove("is-active");

    allSukisTab.setAttribute("aria-selected", "false");
  }

  if (scanView) {
    scanView.hidden = false;
  }

  if (allSukisView) {
    allSukisView.hidden = true;
  }
}

function showAllSukisTab() {
  if (allSukisTab) {
    allSukisTab.classList.add("is-active");

    allSukisTab.setAttribute("aria-selected", "true");
  }

  if (scanTab) {
    scanTab.classList.remove("is-active");

    scanTab.setAttribute("aria-selected", "false");
  }

  if (scanView) {
    scanView.hidden = true;
  }

  if (allSukisView) {
    allSukisView.hidden = false;
  }

  renderSukiList();
}

/* =========================================================
   SUKI LIST
========================================================= */

function renderSukiList() {
  if (!sukiList) {
    return;
  }

  renderSukiOverview();
  const query = sukiSearch?.value.toLowerCase().trim() || "";

  const matchesFilter = (suki) => {
    if (selectedSukiFilter === "linked") {
      return Boolean(suki.active && suki.nfcId);
    }

    if (selectedSukiFilter === "unlinked") {
      return !suki.nfcId;
    }

    if (selectedSukiFilter === "ready") {
      return Boolean(suki.active && sukiRules.canRedeem(sukiRules.usablePoints(suki)) && sukiRules.balance(suki) > 0);
    }

    if (selectedSukiFilter === "inactive") {
      return !suki.active;
    }

    return true;
  };

  const getMatchRank = (suki) => {
    if (!query) {
      return 0;
    }

    const name = String(suki.name || "").toLowerCase();
    const phone = String(suki.phone || "").toLowerCase();
    const nfc = String(suki.nfcId || "").toLowerCase();

    if (name.startsWith(query)) {
      return 0;
    }

    if (phone.startsWith(query) || nfc.startsWith(query)) {
      return 1;
    }

    return 2;
  };

  const sukis = sukiStore.read()
    .filter(matchesFilter)
    .filter((suki) => {
      const name = String(suki.name || "").toLowerCase();
      const phone = String(suki.phone || "").toLowerCase();
      const nfc = String(suki.nfcId || "").toLowerCase();

      return (
        !query ||
        name.includes(query) ||
        phone.includes(query) ||
        nfc.includes(query)
      );
    })
    .sort((first, second) => {
      const rankDifference = getMatchRank(first) - getMatchRank(second);

      if (rankDifference !== 0) {
        return rankDifference;
      }

      return String(first.name || "").localeCompare(String(second.name || ""));
    });

  if (!sukis.length) {
    sukiList.innerHTML = `
      <div class="empty-results">
        No Suki customers found.
      </div>
    `;

    return;
  }

  sukiList.innerHTML = sukis
    .map(
      (suki) => {
        const stampProgress = Math.min(
          100,
          Math.round((sukiRules.displayPoints(suki) / sukiRules.maxPoints()) * 100),
        );
        const isReady = suki.active && sukiRules.canRedeem(sukiRules.usablePoints(suki)) && sukiRules.balance(suki) > 0;
        const statusLabel = !suki.active
          ? "Inactive"
          : isReady
            ? "Ready to redeem"
            : suki.nfcId
              ? "NFC linked"
              : "No NFC card";

        return `
          <button
            class="suki-card ${isReady ? "is-ready" : ""} ${suki.active ? "" : "is-inactive"}"
            type="button"
            data-suki-id="${escapeHtml(suki.id)}"
          >

            <div class="suki-card-main">

              <strong class="suki-card-name">
                ${escapeHtml(suki.name)}
              </strong>

              <small class="suki-card-phone">
                ${suki.phone ? escapeHtml(suki.phone) : "No phone number"}
              </small>

              <span class="suki-card-status ${isReady ? "is-ready" : ""} ${suki.active ? "" : "is-inactive"}">
                ${statusLabel}
              </span>

              <div class="suki-card-progress" aria-label="${sukiRules.displayPoints(suki)} of ${sukiRules.maxPoints()} points">
                <span style="width:${stampProgress}%"></span>
              </div>

            </div>

            <div class="suki-card-stats">

              <div>
                <strong>
                  ${sukiRules.displayPoints(suki)}/${sukiRules.maxPoints()} points
                </strong>

                <small>
                  Stamps
                </small>
              </div>

              <div>
                <strong>
                  ${peso(sukiRules.balance(suki))}
                </strong>

                <small>
                  Reward
                </small>
              </div>

            </div>

          </button>
        `;
      },
    )
    .join("");

  sukiList.querySelectorAll("[data-suki-id]").forEach((button) => {
    button.addEventListener("click", () => {
      showSukiDetails(button.dataset.sukiId);
    });
  });
}

/* =========================================================
   SUKI DETAILS
   CLEAN / ORGANIZED DESIGN
========================================================= */

function showSukiDetails(id) {
  const suki = sukiStore.read().find((entry) => entry.id === id);

  if (!suki) {
    return;
  }

  selectedSukiId = suki.id;

  if (detailTitle) {
    detailTitle.textContent = suki.name;
  }

  if (!detailContent) {
    return;
  }

  const history = Array.isArray(suki.history) ? suki.history : [];

  const stampProgress = Math.min(100, (sukiRules.displayPoints(suki) / sukiRules.maxPoints()) * 100);
  const remainingStamps = Math.max(0, sukiRules.maxPoints() - sukiRules.displayPoints(suki));
  const rewardBalance = sukiRules.balance(suki);

  detailContent.innerHTML = `

    <div class="suki-detail-layout">

      <!-- ===============================================
           CUSTOMER HEADER
      ================================================ -->

      <div class="suki-profile-card">

        <div class="suki-profile-avatar">
          ${escapeHtml(suki.name.charAt(0).toUpperCase())}
        </div>

        <div class="suki-profile-info">

          <h3>
            ${escapeHtml(suki.name)}
          </h3>

          <p>
            Suki Customer
          </p>

        </div>

      </div>


      <!-- ===============================================
           CUSTOMER INFORMATION
      ================================================ -->

      <section class="suki-info-section">

        <div class="suki-section-heading">

          <div>
            <span class="suki-section-label">
              CUSTOMER INFORMATION
            </span>

            <h4>
              Personal Details
            </h4>
          </div>

        </div>

        <div class="suki-info-grid">

          <div class="suki-info-item">

            <span>
              Full Name
            </span>

            <strong>
              ${escapeHtml(suki.name)}
            </strong>

          </div>


          <div class="suki-info-item">

            <span>
              Phone Number
            </span>

            <strong>
              ${suki.phone ? escapeHtml(suki.phone) : "Not provided"}
            </strong>

          </div>


          <div class="suki-info-item">

            <span>
              Date Joined
            </span>

            <strong>
              ${formatDate(suki.joined)}
            </strong>

          </div>


          <div class="suki-info-item">

            <span>
              Account Status
            </span>

            <strong class="suki-status-active">
              ${suki.active ? "Active" : "Inactive"}
            </strong>

          </div>

        </div>

      </section>


      <!-- ===============================================
           REWARDS SUMMARY
      ================================================ -->

      <section class="suki-info-section">

        <div class="suki-section-heading">

          <div>

            <span class="suki-section-label">
              REWARDS
            </span>

            <h4>
              Loyalty Progress
            </h4>

          </div>

        </div>


        <div class="suki-reward-grid">

          <div class="suki-reward-stat">

            <span>
              Stamps
            </span>

            <strong>
              ${sukiRules.displayPoints(suki)}
              <small>
                / ${sukiRules.maxPoints()}
              </small>
            </strong>

          </div>


          <div class="suki-reward-stat">

            <span>
              Reward Balance
            </span>

            <strong>
              ${peso(rewardBalance)}
            </strong>

          </div>

        </div>


        <div class="suki-progress-box">

          <div class="suki-progress-header">

            <span>
              Stamp Progress
            </span>

            <strong>
              ${Math.round(stampProgress)}%
            </strong>

          </div>


          <div
            class="suki-progress-track"
            aria-label="Stamp progress"
          >

            <div
              class="suki-progress-fill"
              style="
                width:${stampProgress}%;
              "
            ></div>

          </div>


          <div class="suki-progress-footer">

            <span>
              ${
                remainingStamps === 0
                  ? "Maximum stamps reached"
                  : `${remainingStamps} stamps remaining`
              }
            </span>

            <span>
              ${sukiRules.displayPoints(suki)}/${sukiRules.maxPoints()} points
            </span>

          </div>

        </div>

      </section>


      <!-- ===============================================
           NFC INFORMATION
      ================================================ -->

      <section class="suki-info-section">

        <div class="suki-section-heading">

          <div>

            <span class="suki-section-label">
              NFC CARD
            </span>

            <h4>
              Card Information
            </h4>

          </div>

        </div>


        <div class="suki-nfc-card">

          <div class="suki-nfc-icon">
            NFC
          </div>

          <div class="suki-nfc-info">

            <span>
              Card Serial Number
            </span>

            <strong
              class="suki-nfc-serial${
                suki.nfcId ? "" : " suki-nfc-serial-empty"
              }"
            >
              ${suki.nfcId ? escapeHtml(suki.nfcId) : "No NFC card linked"}
            </strong>

            ${
              suki.nfcId
                ? ""
                : `
                  <div class="suki-nfc-actions">

                    <button
                      type="button"
                      id="linkNfcDetailButton"
                      class="secondary-button suki-nfc-link-button"
                    >
                      Link NFC Card
                    </button>

                    <small
                      id="linkNfcDetailStatus"
                      class="suki-nfc-link-status"
                    >
                      Ready to link a card.
                    </small>

                  </div>
                `
            }

          </div>

          <div
            class="suki-nfc-status${
              suki.nfcId
                ? " suki-nfc-status-linked"
                : " suki-nfc-status-unlinked"
            }"
          >

            ${suki.nfcId ? "Linked" : "Not Linked"}

          </div>

        </div>

      </section>


      <!-- ===============================================
           TRANSACTION HISTORY
      ================================================ -->

      <section class="suki-info-section">

        <div class="suki-section-heading">

          <div>

            <span class="suki-section-label">
              ACTIVITY
            </span>

            <h4>
              Transaction History
            </h4>

          </div>

          <span class="suki-history-count">
            ${history.length}
            ${history.length === 1 ? "transaction" : "transactions"}
          </span>

        </div>


        ${
          history.length
            ? `

              <div class="suki-history-list">

                ${history
                  .slice()
                  .reverse()
                  .map(
                    (entry) => `

                      <div class="suki-history-item">

                        <div class="suki-history-icon">
                          ✓
                        </div>

                        <div class="suki-history-main">

                          <div class="suki-history-top">

                            <strong>
                              ${escapeHtml(entry.type || "Purchase")}
                            </strong>

                            <span>
                              ${formatDate(entry.date)}
                            </span>

                          </div>


                          <div class="suki-history-details">

                            <span>
                              Purchase:
                              <strong>
                                ${peso(entry.purchaseTotal)}
                              </strong>
                            </span>

                            <span>
                              Stamps:
                              <strong>
                                ${entry.stampsEarned ?? 0}
                              </strong>
                            </span>

                            ${
                              Number(entry.rewardUsed) > 0
                                ? `
                                  <span>
                                    Reward used:
                                    <strong>
                                      ${peso(entry.rewardUsed)}
                                    </strong>
                                  </span>
                                `
                                : ""
                            }

                          </div>

                        </div>

                      </div>

                    `,
                  )
                  .join("")}

              </div>

            `
            : `

              <div class="suki-empty-history">

                <div class="suki-empty-history-icon">
                  —
                </div>

                <strong>
                  No transactions yet
                </strong>

                <span>
                  This customer's purchases
                  will appear here.
                </span>

              </div>

            `
        }

      </section>

      <div class="usb-card-box" data-usb-card-box></div>


      <!-- ===============================================
           ACTIONS
      ================================================ -->

      <div class="suki-detail-actions">

        ${
          suki.nfcId
            ? `
              <button
                type="button"
                id="unlinkNfcButton"
                class="secondary-button"
              >
                Unlink NFC
              </button>
            `
            : ""
        }

        <button
          type="button"
          id="deleteFromDetail"
          class="secondary-button delete-button"
        >
          Delete Suki
        </button>

        <button
          type="button"
          id="detailCloseButton"
          class="cancel-button"
        >
          Close
        </button>

      </div>

    </div>
  `;

  addUsbCardControls(suki);

  /* =======================================================
     DETAIL EVENTS
  ======================================================= */

  document
    .getElementById("detailCloseButton")
    ?.addEventListener("click", () => {
      closeModal(detailModal);
    });

  document.getElementById("deleteFromDetail")?.addEventListener("click", () => {
    closeModal(detailModal);

    openDeleteSuki(suki.id);
  });

  document
    .getElementById("unlinkNfcButton")
    ?.addEventListener("click", unlinkSelectedNfc);

  document
    .getElementById("linkNfcDetailButton")
    ?.addEventListener("click", linkNfcToSelectedSuki);

  openModal(detailModal);
}

/* =========================================================
   DELETE
========================================================= */

let deleteSukiId = "";

function openDeleteSuki(id) {
  const suki = sukiStore.read().find((entry) => entry.id === id);

  if (!suki) {
    return;
  }

  deleteSukiId = suki.id;

  if (deleteSukiCopy) {
    deleteSukiCopy.textContent = `${suki.name} will be removed from Suki Rewards.`;
  }

  openModal(deleteSukiModal);
}

function deleteSuki() {
  if (!deleteSukiId) {
    return;
  }

  const result = sukiStore.remove(deleteSukiId);
  if (!result.ok) return;

  deleteSukiId = "";

  closeModal(deleteSukiModal);

  renderSukiList();
}

/* =========================================================
   UNLINK NFC
========================================================= */

async function linkNfcToSelectedSuki() {
  const sukiId = selectedSukiId;

  if (!sukiId) {
    return;
  }

  const linkButton = document.getElementById("linkNfcDetailButton");

  const linkStatus = document.getElementById("linkNfcDetailStatus");

  if (!isNfcSupported()) {
    await scanNfcCard(() => {});

    if (linkButton) {
      linkButton.disabled = false;

      linkButton.textContent = "Link NFC Card";
    }

    return;
  }

  if (linkButton) {
    linkButton.disabled = true;

    linkButton.textContent = "Scanning...";
  }

  if (linkStatus) {
    linkStatus.textContent = "Hold the NFC card near the back of your phone.";
  }

  await scanNfcCard((nfcId) => {
    const sukis = sukiStore.read();

    const existing = sukis.find((suki) => suki.nfcId === nfcId);

    if (existing) {
      if (linkButton) {
        linkButton.disabled = false;

        linkButton.textContent = "Link NFC Card";
      }

      if (linkStatus) {
        linkStatus.textContent =
          "This card is already linked to an existing account.";
      }

      return;
    }

    const index = sukis.findIndex((suki) => suki.id === sukiId);

    if (index === -1) {
      return;
    }

    sukis[index].nfcId = nfcId;

    const result = sukiStore.save(sukis);
    if (!result.ok) return;

    showSukiDetails(sukiId);
  });
}

function unlinkSelectedNfc() {
  if (!selectedSukiId) {
    return;
  }

  const sukis = sukiStore.read();

  const index = sukis.findIndex((suki) => suki.id === selectedSukiId);

  if (index === -1) {
    return;
  }

  unlinkSukiId = selectedSukiId;

  if (unlinkNfcCopy) {
    unlinkNfcCopy.textContent = `Unlink the NFC card from ${sukis[index].name}?`;
  }

  openModal(unlinkNfcModal);
}

function confirmUnlinkSelectedNfc() {
  if (!unlinkSukiId) {
    return;
  }

  const sukis = sukiStore.read();

  const index = sukis.findIndex((suki) => suki.id === unlinkSukiId);

  if (index === -1) {
    return;
  }

  sukis[index].nfcId = "";

  const result = sukiStore.save(sukis);
  if (!result.ok) return;

  unlinkSukiId = "";

  closeModal(unlinkNfcModal);

  showSukiDetails(selectedSukiId);
}

function closeUnlinkNfcModal() {
  unlinkSukiId = "";

  closeModal(unlinkNfcModal);
}

/* =========================================================
   EVENTS
========================================================= */

openAddSuki?.addEventListener("click", openAddSukiForm);

closeAddSuki?.addEventListener("click", closeAddSukiForm);

cancelAddSuki?.addEventListener("click", closeAddSukiForm);

addSukiForm?.addEventListener("submit", saveSuki);

sukiName?.addEventListener("input", validateSukiFields);

sukiPhone?.addEventListener("input", validateSukiFields);

validateSukiFields();

linkNfcButton?.addEventListener("click", linkNfcCard);

scanButton?.addEventListener("click", scanExistingSuki);

scanTab?.addEventListener("click", showScanTab);

allSukisTab?.addEventListener("click", showAllSukisTab);

sukiSearch?.addEventListener("input", renderSukiList);

document.querySelectorAll("[data-suki-filter]").forEach((filterButton) => {
  filterButton.addEventListener("click", () => {
    selectedSukiFilter = filterButton.dataset.sukiFilter || "all";

    document.querySelectorAll("[data-suki-filter]").forEach((button) => {
      const isSelected = button === filterButton;
      button.classList.toggle("is-active", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });

    renderSukiList();
  });
});

closeDetail?.addEventListener("click", () => {
  closeModal(detailModal);
});

closeDeleteSuki?.addEventListener("click", () => {
  closeModal(deleteSukiModal);
});

cancelDeleteSuki?.addEventListener("click", () => {
  closeModal(deleteSukiModal);
});

confirmDeleteSuki?.addEventListener("click", deleteSuki);

closeUnlinkNfc?.addEventListener("click", closeUnlinkNfcModal);

cancelUnlinkNfc?.addEventListener("click", closeUnlinkNfcModal);

confirmUnlinkNfc?.addEventListener("click", confirmUnlinkSelectedNfc);

/* =========================================================
   CLOSE MODAL OUTSIDE
========================================================= */

[addSukiModal, detailModal, deleteSukiModal, unlinkNfcModal].forEach(
  (modal) => {
    modal?.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal);
      }
    });
  },
);

/* =========================================================
   ESC KEY
========================================================= */

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  closeModal(addSukiModal);

  closeModal(detailModal);

  closeModal(deleteSukiModal);

  closeUnlinkNfcModal();
});

/* =========================================================
   INITIALIZE
========================================================= */

if (sukiJoined) {
  sukiJoined.value = new Date().toISOString().split("T")[0];
}

renderSukiList();
window.miniMartInitialDataReady = true;
