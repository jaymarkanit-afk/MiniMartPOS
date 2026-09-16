const STORAGE_KEY = "miniMartSukis";
const scanButton = document.getElementById("scanButton");
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

async function startNfcReader(onReading, statusElement) {
  if (nfcReaderActive) return;
  if (!("NDEFReader" in window)) {
    statusElement.textContent = "Web NFC is not supported on this device";
    return;
  }
  try {
    const reader = new NDEFReader();
    await reader.scan();
    nfcReaderActive = true;
    statusElement.textContent = "Hold an NFC card near the back of the phone";
    reader.onreading = (event) => {
      onReading(event.serialNumber || "linked-nfc-card");
      nfcReaderActive = false;
    };
    reader.onreadingerror = () => {
      statusElement.textContent = "NFC card could not be read. Try again";
      nfcReaderActive = false;
    };
  } catch {
    statusElement.textContent = "NFC permission is required to scan a card";
    nfcReaderActive = false;
  }
}

function handleScan(cardId) {
  const suki = sukis.find((entry) => entry.cardId === cardId);
  if (!suki) {
    scanStatus.textContent = "Card read. No Suki is linked to this card";
    return;
  }
  openDetail(suki.id);
}

function openDetail(id) {
  const suki = sukis.find((entry) => entry.id === id);
  if (!suki) return;
  activeSukiId = id;
  const status = getStatus(suki);
  detailTitle.textContent = suki.name;
  detailContent.innerHTML = `<div class="detail-customer"><span class="suki-avatar" aria-hidden="true">${escapeHtml(suki.name.trim().charAt(0).toUpperCase())}</span><div><strong class="detail-name">${escapeHtml(suki.name)}</strong><p class="detail-meta">Suki since ${formatDate(suki.joined)}${suki.phone ? ` · ${escapeHtml(suki.phone)}` : ""}</p></div></div>
    <div class="detail-progress">${stampDots(suki.stamps, true)}<p class="progress-text">${suki.stamps} / 10 stamps</p><p class="detail-status ${status.className}">${status.label}</p></div>
    <div class="detail-actions"><button class="detail-action" id="detailAddStamp" type="button" ${suki.stamps >= 10 || suki.redeemed ? "disabled" : ""}>Scan card to stamp</button><button class="secondary-button" id="detailRedeem" type="button" ${suki.stamps < 10 || suki.redeemed ? "disabled" : ""}>Mark redeemed</button><button class="secondary-button" id="detailEdit" type="button">Edit Suki</button><button class="secondary-button delete-suki-button" id="detailDelete" type="button">Delete Suki</button></div><p class="detail-scan-status" id="detailScanStatus" aria-live="polite">A real NFC card is required for every stamp.</p>`;
  document.getElementById("detailAddStamp").addEventListener("click", () => {
    const detailScanStatus = document.getElementById("detailScanStatus");
    startNfcReader((cardId) => {
      if (suki.cardId && suki.cardId !== cardId) {
        detailScanStatus.textContent = "This NFC card belongs to another Suki";
        return;
      }
      const changes = { stamps: Math.min(10, suki.stamps + 1) };
      if (!suki.cardId) changes.cardId = cardId;
      updateSuki(changes);
    }, detailScanStatus);
  });
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

function resetAddForm() {
  editingSukiId = null;
  addSukiForm.reset();
  sukiFormEyebrow.textContent = "NEW CUSTOMER";
  addSukiTitle.textContent = "Add a Suki";
  saveSukiButton.textContent = "Save Suki";
  sukiJoined.value = new Date().toISOString().slice(0, 10);
  linkedCardId = "";
  linkStatus.textContent = "Optional. You can link one later.";
  linkNfcButton.textContent = "Tap card";
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
  startNfcReader(handleScan, scanStatus),
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
  startNfcReader((cardId) => {
    linkedCardId = cardId;
    linkStatus.textContent = "NFC card linked. You can save this Suki.";
    linkNfcButton.textContent = "Card linked";
  }, linkStatus),
);
addSukiForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = sukiName.value.trim();
  if (!name) return;
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
