void (async () => {
  const client = window.supabaseClient;
  const { data, error } = client
    ? await client.auth.getSession()
    : { data: null, error: true };
  if (error || !data.session?.user?.email_confirmed_at) {
    if (client) await client.auth.signOut();
    window.location.replace("login.html");
  }
})();

const STORAGE_KEY = "miniMartSukis";
const scanButton = document.getElementById("scanButton");
const scanTitle = document.getElementById("scanTitle");
const scanStatus = document.getElementById("scanStatus");
const scanTab = document.getElementById("scanTab");
const allSukisTab = document.getElementById("allSukisTab");
const scanView = document.getElementById("scanView");
const allSukisView = document.getElementById("allSukisView");
const sukiList = document.getElementById("sukiList");
const sukiSearch = document.getElementById("sukiSearch");
const addSukiModal = document.getElementById("addSukiModal");
const addSukiForm = document.getElementById("addSukiForm");
const sukiName = document.getElementById("sukiName");
const sukiPhone = document.getElementById("sukiPhone");
const sukiJoined = document.getElementById("sukiJoined");
const linkNfcButton = document.getElementById("linkNfcButton");
const linkStatus = document.getElementById("linkStatus");
const sukiFormEyebrow = document.getElementById("sukiFormEyebrow");
const addSukiTitle = document.getElementById("addSukiTitle");
const saveSukiButton = document.getElementById("saveSukiButton");
const detailModal = document.getElementById("detailModal");
const detailTitle = document.getElementById("detailTitle");
const detailContent = document.getElementById("detailContent");
const deleteSukiModal = document.getElementById("deleteSukiModal");
const deleteSukiCopy = document.getElementById("deleteSukiCopy");
let sukis = readSukis();
let linkedCardId = "";
let activeSukiId = null;
let editingSukiId = null;
let pendingDeleteSukiId = null;
let nfcReaderActive = false;
let pendingScannedCardId = "";
let nfcScanTimeout = null;
let nfcResultTimer = null;

function readSukis() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveSukis() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sukis));
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character],
  );
}

function formatDate(value) {
  if (!value) return "Unknown date";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatus(suki) {
  if (suki.redeemed) return { label: "Redeemed", className: "is-redeemed" };
  if (suki.stamps >= 10)
    return { label: "Reward ready", className: "is-ready" };
  return { label: "In progress", className: "" };
}

function stampDots(stampCount, large = false) {
  return `<div class="stamp-dots${large ? " large-dots" : ""}" aria-label="${stampCount} of 10 stamps">${Array.from({ length: 10 }, (_, index) => `<span class="stamp-dot${index < stampCount ? " is-filled" : ""}"></span>`).join("")}</div>`;
}

function renderSukiList() {
  const query = sukiSearch.value.trim().toLowerCase();
  const matches = sukis.filter((suki) =>
    suki.name.toLowerCase().includes(query),
  );
  if (!matches.length) {
    sukiList.innerHTML = `<div class="empty-list">${sukis.length ? "No Sukis match your search." : "No Sukis registered yet. Add your first customer to get started."}</div>`;
    return;
  }
  sukiList.innerHTML = matches
    .map((suki) => {
      const status = getStatus(suki);
      return `<button class="suki-row ${status.className === "is-ready" ? "is-ready" : ""}" type="button" data-suki-id="${suki.id}">
      <span class="suki-avatar" aria-hidden="true">${escapeHtml(suki.name.trim().charAt(0).toUpperCase())}</span>
      <span><strong class="suki-row-name">${escapeHtml(suki.name)}</strong><small class="suki-row-meta">Suki since ${formatDate(suki.joined)}</small></span>
      <span class="stamp-progress">${stampDots(suki.stamps)}<small class="progress-text">${suki.stamps} / 10 stamps</small></span>
      <span class="status-label ${status.className}">${status.label}</span>
    </button>`;
    })
    .join("");
}

function setView(view) {
  const showAll = view === "all";
  scanView.hidden = showAll;
  allSukisView.hidden = !showAll;
  scanTab.classList.toggle("is-active", !showAll);
  allSukisTab.classList.toggle("is-active", showAll);
  scanTab.setAttribute("aria-selected", String(!showAll));
  allSukisTab.setAttribute("aria-selected", String(showAll));
  if (showAll) renderSukiList();
}

function openModal(modal) {
  modal.hidden = false;
}

function closeModal(modal) {
  modal.hidden = true;
}

function cardSuffix(cardId) {
  return cardId.slice(-4).toUpperCase();
}

function findCardOwner(cardId, excludedSukiId = null) {
  if (!cardId) return undefined;
  return sukis.find(
    (suki) => suki.id !== excludedSukiId && suki.cardId === cardId,
  );
}

function setScanStatus(text) {
  scanStatus.textContent = text;
}

function vibrate(pattern) {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
}

function setMainScanState(state) {
  scanButton.classList.remove("is-listening", "is-detected");
  if (state === "listening") {
    scanButton.classList.add("is-listening");
    scanButton.disabled = true;
    scanButton.setAttribute("aria-label", "Scanning for NFC card");
    scanTitle.textContent = "Scanning... hold your card now";
    return;
  }
  if (state === "detected") {
    scanButton.classList.add("is-detected");
    scanButton.disabled = true;
    scanButton.setAttribute("aria-label", "NFC card detected");
    scanTitle.textContent = "Card detected";
    return;
  }
  scanButton.disabled = false;
  scanButton.setAttribute("aria-label", "Start NFC reader");
  scanTitle.textContent = "Ready for NFC card";
}

function setLinkButtonState(state) {
  if (state === "scanning") {
    linkNfcButton.disabled = true;
    linkNfcButton.textContent = "Scanning... hold the card now";
    return;
  }
  if (state === "detected") {
    linkNfcButton.disabled = true;
    linkNfcButton.textContent = "Card detected";
    return;
  }
  linkNfcButton.disabled = false;
  linkNfcButton.textContent = "Tap card";
}

function showScanFailure(
  statusElement,
  message,
  mainScan = false,
  linkScan = false,
) {
  nfcReaderActive = false;
  window.clearTimeout(nfcScanTimeout);
  nfcScanTimeout = null;
  if (mainScan) setMainScanState("idle");
  if (linkScan) setLinkButtonState("idle");
  statusElement.textContent = message;
  vibrate([50, 70, 50]);
  window.clearTimeout(nfcResultTimer);
  nfcResultTimer = window.setTimeout(() => {
    if (statusElement === scanStatus)
      setScanStatus("Press the NFC icon to start the reader");
  }, 4500);
}

function showDetectedCard(
  statusElement,
  cardId,
  mainScan = false,
  linkScan = false,
) {
  const text = `✓ Card detected: ...${cardSuffix(cardId)}`;
  statusElement.textContent = text;
  if (mainScan) setMainScanState("detected");
  if (linkScan) setLinkButtonState("detected");
  vibrate(100);
}

async function startNfcReader({
  onReading,
  statusElement,
  mainScan = false,
  linkScan = false,
}) {
  if (nfcReaderActive) return false;
  if (mainScan) setMainScanState("listening");
  if (linkScan) setLinkButtonState("scanning");
  if (!("NDEFReader" in window)) {
    showScanFailure(
      statusElement,
      "NFC scanning isn't supported on this device or browser. Use Chrome on an Android phone with NFC enabled.",
      mainScan,
      linkScan,
    );
    return false;
  }
  nfcReaderActive = true;
  let reader;
  const fail = (message) =>
    showScanFailure(statusElement, message, mainScan, linkScan);
  try {
    reader = new NDEFReader();
    await reader.scan();
    nfcScanTimeout = window.setTimeout(() => {
      reader.onreading = null;
      reader.onreadingerror = null;
      fail(
        "No card detected. Try again and hold the card steady against the back of the phone.",
      );
    }, 15000);
    statusElement.textContent = "Hold an NFC card near the back of the phone";
    reader.onreading = (event) => {
      const cardId =
        typeof event.serialNumber === "string" ? event.serialNumber.trim() : "";
      if (!cardId) {
        reader.onreading = null;
        reader.onreadingerror = null;
        fail(
          "No card detected. Try again and hold the card steady against the back of the phone.",
        );
        return;
      }
      window.clearTimeout(nfcScanTimeout);
      nfcScanTimeout = null;
      nfcReaderActive = false;
      reader.onreading = null;
      reader.onreadingerror = null;
      showDetectedCard(statusElement, cardId, mainScan, linkScan);
      window.clearTimeout(nfcResultTimer);
      nfcResultTimer = window.setTimeout(() => {
        onReading(cardId);
        if (mainScan) setMainScanState("idle");
      }, 900);
    };
    reader.onreadingerror = () => {
      reader.onreading = null;
      reader.onreadingerror = null;
      fail(
        "No card detected. Try again and hold the card steady against the back of the phone.",
      );
    };
    return true;
  } catch (error) {
    const message =
      error?.name === "NotAllowedError" || error?.name === "SecurityError"
        ? "NFC permission is needed to scan cards. Please allow it and try again."
        : error?.name === "NotSupportedError"
          ? "NFC scanning isn't supported on this device or browser. Use Chrome on an Android phone with NFC enabled."
          : "No card detected. Try again and hold the card steady against the back of the phone.";
    fail(message);
    return false;
  }
}

function handlePurchaseScan(cardId) {
  if (!cardId) {
    setScanStatus(
      "Card couldn't be read. Try holding it steadier against the back of the phone.",
    );
    return;
  }
  const suki = sukis.find((entry) => entry.cardId === cardId);
  if (!suki) {
    pendingScannedCardId = cardId;
    scanStatus.innerHTML = `This card isn't linked to any Suki yet. <button class="detail-action" id="registerScannedCard" type="button">Register as new Suki</button>`;
    document
      .getElementById("registerScannedCard")
      .addEventListener("click", () =>
        openAddSukiForCard(pendingScannedCardId),
      );
    return;
  }
  const nextStampCount = Math.min(10, suki.stamps + 1);
  const stampAdded = nextStampCount > suki.stamps && !suki.redeemed;
  if (stampAdded) {
    const index = sukis.findIndex((entry) => entry.id === suki.id);
    sukis[index] = { ...sukis[index], stamps: nextStampCount };
    saveSukis();
  }
  openDetail(suki.id);
  const detailScanStatus = document.getElementById("detailScanStatus");
  const confirmation = stampAdded
    ? `+1 stamp for ${suki.name} — now ${nextStampCount} / 10`
    : `${suki.name} already has all available stamps.`;
  const rewardMessage = nextStampCount >= 10 ? " Reward ready!" : "";
  setScanStatus(`${confirmation}${rewardMessage}`);
  detailScanStatus.textContent = `${confirmation}${rewardMessage}`;
}

function openDetail(id) {
  const suki = sukis.find((entry) => entry.id === id);
  if (!suki) return;
  activeSukiId = id;
  const status = getStatus(suki);
  detailTitle.textContent = suki.name;
  detailContent.innerHTML = `<div class="detail-customer"><span class="suki-avatar" aria-hidden="true">${escapeHtml(suki.name.trim().charAt(0).toUpperCase())}</span><div><strong class="detail-name">${escapeHtml(suki.name)}</strong><p class="detail-meta">Suki since ${formatDate(suki.joined)}${suki.phone ? ` · ${escapeHtml(suki.phone)}` : ""}</p></div></div>
    <div class="detail-progress">${stampDots(suki.stamps, true)}<p class="progress-text">${suki.stamps} / 10 stamps</p><p class="detail-status ${status.className}">${status.label}</p></div>
    <div class="detail-actions"><button class="secondary-button" id="detailRedeem" type="button" ${suki.stamps < 10 || suki.redeemed ? "disabled" : ""}>Mark redeemed</button><button class="secondary-button" id="detailEdit" type="button">Edit Suki</button><button class="secondary-button delete-suki-button" id="detailDelete" type="button">Delete Suki</button></div><p class="detail-scan-status" id="detailScanStatus" aria-live="polite">Scan this Suki's NFC card to add a stamp.</p>`;
  document
    .getElementById("detailRedeem")
    .addEventListener("click", () => updateSuki({ redeemed: true }));
  document
    .getElementById("detailEdit")
    .addEventListener("click", () => openEditSuki(suki));
  document.getElementById("detailDelete").addEventListener("click", () => {
    pendingDeleteSukiId = suki.id;
    deleteSukiCopy.textContent = `${suki.name} will be removed from Suki Rewards. This action cannot be undone.`;
    openModal(deleteSukiModal);
    document.getElementById("confirmDeleteSuki").focus();
  });
  openModal(detailModal);
}

function updateSuki(changes) {
  const index = sukis.findIndex((entry) => entry.id === activeSukiId);
  if (index === -1) return;
  sukis[index] = { ...sukis[index], ...changes };
  saveSukis();
  closeModal(detailModal);
  renderSukiList();
}

function resetAddForm(cardId = "") {
  editingSukiId = null;
  addSukiForm.reset();
  sukiFormEyebrow.textContent = "NEW CUSTOMER";
  addSukiTitle.textContent = "Add a Suki";
  saveSukiButton.textContent = "Save Suki";
  sukiJoined.value = new Date().toISOString().slice(0, 10);
  linkedCardId = cardId;
  linkStatus.textContent = cardId
    ? `Card linked successfully (UID ...${cardSuffix(cardId)})`
    : "Optional. You can link one later.";
  linkNfcButton.textContent = cardId ? "Card linked" : "Tap card";
}

function openAddSukiForCard(cardId) {
  resetAddForm(cardId);
  openModal(addSukiModal);
  sukiName.focus();
}

function openEditSuki(suki) {
  editingSukiId = suki.id;
  sukiFormEyebrow.textContent = "CUSTOMER MANAGEMENT";
  addSukiTitle.textContent = "Edit Suki";
  saveSukiButton.textContent = "Save changes";
  sukiName.value = suki.name;
  sukiPhone.value = suki.phone || "";
  sukiJoined.value = suki.joined;
  linkedCardId = suki.cardId || "";
  linkStatus.textContent = linkedCardId
    ? "NFC card is linked. Tap to replace it."
    : "No NFC card linked yet.";
  linkNfcButton.textContent = linkedCardId ? "Relink card" : "Tap card";
  closeModal(detailModal);
  openModal(addSukiModal);
  sukiName.focus();
}

scanButton.addEventListener("click", () =>
  startNfcReader({
    onReading: handlePurchaseScan,
    statusElement: scanStatus,
    mainScan: true,
  }),
);
scanTab.addEventListener("click", () => setView("scan"));
allSukisTab.addEventListener("click", () => setView("all"));
sukiSearch.addEventListener("input", renderSukiList);
sukiList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-suki-id]");
  if (row) openDetail(row.dataset.sukiId);
});
document.getElementById("openAddSuki").addEventListener("click", () => {
  resetAddForm();
  openModal(addSukiModal);
  sukiName.focus();
});
document
  .getElementById("closeAddSuki")
  .addEventListener("click", () => closeModal(addSukiModal));
document
  .getElementById("cancelAddSuki")
  .addEventListener("click", () => closeModal(addSukiModal));
document
  .getElementById("closeDetail")
  .addEventListener("click", () => closeModal(detailModal));
document
  .getElementById("closeDeleteSuki")
  .addEventListener("click", () => closeModal(deleteSukiModal));
document
  .getElementById("cancelDeleteSuki")
  .addEventListener("click", () => closeModal(deleteSukiModal));
document.getElementById("confirmDeleteSuki").addEventListener("click", () => {
  if (!pendingDeleteSukiId) return;
  sukis = sukis.filter((entry) => entry.id !== pendingDeleteSukiId);
  saveSukis();
  pendingDeleteSukiId = null;
  closeModal(deleteSukiModal);
  closeModal(detailModal);
  renderSukiList();
});
addSukiModal.addEventListener("click", (event) => {
  if (event.target === addSukiModal) closeModal(addSukiModal);
});
detailModal.addEventListener("click", (event) => {
  if (event.target === detailModal) closeModal(detailModal);
});
deleteSukiModal.addEventListener("click", (event) => {
  if (event.target === deleteSukiModal) closeModal(deleteSukiModal);
});
linkNfcButton.addEventListener("click", () =>
  startNfcReader({
    onReading: (cardId) => {
      if (!cardId) {
        linkStatus.textContent =
          "Card couldn't be read. Try holding it steadier against the back of the phone.";
        return;
      }
      const existingSuki = findCardOwner(cardId, editingSukiId);
      if (existingSuki) {
        linkedCardId = "";
        setLinkButtonState("idle");
        linkStatus.textContent = `This card is already linked to ${existingSuki.name}`;
        linkStatus.textContent += ". Each card can only belong to one Suki.";
        return;
      }
      linkedCardId = cardId;
      linkNfcButton.disabled = false;
      linkStatus.textContent = `Card linked successfully (UID ...${cardSuffix(cardId)})`;
      linkNfcButton.textContent = "Card linked";
    },
    statusElement: linkStatus,
    linkScan: true,
  }),
);
addSukiForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = sukiName.value.trim();
  if (!name) return;
  const existingSuki = findCardOwner(linkedCardId, editingSukiId);
  if (existingSuki) {
    linkedCardId = "";
    setLinkButtonState("idle");
    linkStatus.textContent = `This card is already linked to ${existingSuki.name}`;
    linkStatus.textContent += ". Each card can only belong to one Suki.";
    return;
  }
  if (editingSukiId) {
    const index = sukis.findIndex((suki) => suki.id === editingSukiId);
    if (index !== -1)
      sukis[index] = {
        ...sukis[index],
        name,
        phone: sukiPhone.value.trim(),
        joined: sukiJoined.value,
        cardId: linkedCardId,
      };
  } else {
    sukis.push({
      id: crypto.randomUUID(),
      name,
      phone: sukiPhone.value.trim(),
      joined: sukiJoined.value,
      stamps: 0,
      redeemed: false,
      cardId: linkedCardId,
    });
  }
  saveSukis();
  closeModal(addSukiModal);
  editingSukiId = null;
  setView("all");
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal(addSukiModal);
    closeModal(detailModal);
    closeModal(deleteSukiModal);
  }
});

resetAddForm();
