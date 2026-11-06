// Settings page: elements, shared state and helpers, tabs, search and unsaved changes.
const storeInfoForm = document.getElementById("storeInfoForm");

const settingsStatus = document.getElementById("settingsStatus");

const storeLogoInput = document.getElementById("storeLogo");

const logoPreview = document.getElementById("logoPreview");

const receiptPreviewLogo = document.getElementById("receiptPreviewLogo");

const receiptPreviewStore = document.getElementById("receiptPreviewStore");

const receiptPreviewContact = document.getElementById("receiptPreviewContact");

const receiptPreviewFooter = document.getElementById("receiptPreviewFooter");

const datePreview = document.getElementById("datePreview");

const logoFileName = document.getElementById("logoFileName");

const removeLogo = document.getElementById("removeLogo");

const maxLogoSize = 200 * 1024;

const appearanceForm = document.getElementById("appearanceForm");

const themeToggle = document.getElementById("themeToggle");

const checkNfcStatus = document.getElementById("checkNfcStatus");

const nfcStatusBadge = document.getElementById("nfcStatusBadge");

const nfcStatusText = document.getElementById("nfcStatusText");

const nfcStatusExplanation = document.getElementById("nfcStatusExplanation");

const nfcStatusDetails = document.getElementById("nfcStatusDetails");

const nfcStatusConfirmation = document.getElementById("nfcStatusConfirmation");

const inventoryRulesForm = document.getElementById("inventoryRulesForm");

const inventoryRulesStatus = document.getElementById("inventoryRulesStatus");

const lowStockThreshold = document.getElementById("lowStockThreshold");

const blockOutOfStockSales = document.getElementById("blockOutOfStockSales");

const sukiSettingsForm = document.getElementById("sukiSettingsForm");

const sukiSettingsStatus = document.getElementById("sukiSettingsStatus");

const sukiEnabled = document.getElementById("sukiEnabled");

const sukiPesosPerPoint = document.getElementById("sukiPesosPerPoint");

const sukiPesoValue = document.getElementById("sukiPesoValue");

const sukiMinPointsToRedeem = document.getElementById("sukiMinPointsToRedeem");

const sukiPointsExpiry = document.getElementById("sukiPointsExpiry");

const sukiPointsExpiryDays = document.getElementById("sukiPointsExpiryDays");

const sukiPointsExpiryDaysField = document.getElementById("sukiPointsExpiryDaysField");

const backupStatus = document.getElementById("backupStatus");

const backupSummary = document.getElementById("backupSummary");

const backupRestorePreview = document.getElementById("backupRestorePreview");

const backupRestorePreviewText = document.getElementById("backupRestorePreviewText");

const runDataHealthCheck = document.getElementById("runDataHealthCheck");

const dataHealthResults = document.getElementById("dataHealthResults");

const settingsSearch = document.getElementById("settingsSearch");

const settingsSearchEmpty = document.getElementById("settingsSearchEmpty");

const exportInventoryHistory = document.getElementById("exportInventoryHistory");

const stockHistoryNotice = document.getElementById("stockHistoryNotice");

const restoreBackup = document.getElementById("restoreBackup");

const confirmRestoreBackup = document.getElementById("confirmRestoreBackup");

const cancelRestoreBackup = document.getElementById("cancelRestoreBackup");

const reportExportData = document.getElementById("reportExportData");

const salesRange = document.getElementById("salesRange");

const salesRangeField = document.getElementById("salesRangeField");

const customDateFields = document.getElementById("customDateFields");

const salesStartDate = document.getElementById("salesStartDate");

const salesEndDate = document.getElementById("salesEndDate");

const customerExportNote = document.getElementById("customerExportNote");

const reportExportSummary = document.getElementById("reportExportSummary");

const reportExportStatus = document.getElementById("reportExportStatus");

const exportExcel = document.getElementById("exportExcel");

const exportPdf = document.getElementById("exportPdf");

const downloadProductTemplate = document.getElementById("downloadProductTemplate");

const productImportFile = document.getElementById("productImportFile");

const productImportFileName = document.getElementById("productImportFileName");

const removeProductImportFile = document.getElementById("removeProductImportFile");

const productImportStatus = document.getElementById("productImportStatus");

const downloadProductErrors = document.getElementById("downloadProductErrors");

const productImportModal = document.getElementById("productImportModal");

const closeProductImport = document.getElementById("closeProductImport");

const cancelProductImport = document.getElementById("cancelProductImport");

const productDuplicateMode = document.getElementById("productDuplicateMode");

const productMissingCategoryMode = document.getElementById("productMissingCategoryMode");

const productImportFilter = document.getElementById("productImportFilter");

const productImportSummary = document.getElementById("productImportSummary");

const productImportPreview = document.getElementById("productImportPreview");

const productImportEmpty = document.getElementById("productImportEmpty");

const productImportModalStatus = document.getElementById("productImportModalStatus");

const confirmProductImport = document.getElementById("confirmProductImport");

const openResetData = document.getElementById("openResetData");

const resetDataModal = document.getElementById("resetDataModal");

const closeResetData = document.getElementById("closeResetData");

const cancelResetData = document.getElementById("cancelResetData");

const resetDataCounts = document.getElementById("resetDataCounts");

const resetConfirmText = document.getElementById("resetConfirmText");

const confirmResetData = document.getElementById("confirmResetData");

const backupBeforeReset = document.getElementById("backupBeforeReset");

const resetDataStatus = document.getElementById("resetDataStatus");

const categoryManagementList = document.getElementById("categoryManagementList");

const categoryManagementStatus = document.getElementById("categoryManagementStatus");

const categorySummaryChips = document.getElementById("categorySummaryChips");

const categoryManagementModal = document.getElementById("categoryManagementModal");

const openCategoryManagement = document.getElementById("openCategoryManagement");

const closeCategoryManagement = document.getElementById("closeCategoryManagement");

const doneCategoryManagement = document.getElementById("doneCategoryManagement");

const categoryManagementSearch = document.getElementById("categoryManagementSearch");

const clearCategoryManagementSearch = document.getElementById("clearCategoryManagementSearch");

const categoryManagementEmpty = document.getElementById("categoryManagementEmpty");

const categoryManagementModalSummary = document.getElementById("categoryManagementModalSummary");

const categoryManagementReorderNote = document.getElementById("categoryManagementReorderNote");

const categoryDeleteModal = document.getElementById("categoryDeleteModal");

const categoryDeleteCopy = document.getElementById("categoryDeleteCopy");

const categoryMoveTarget = document.getElementById("categoryMoveTarget");

const settingsTabs = [...document.querySelectorAll("[data-settings-panel]")];

const resetStoreInfo = document.getElementById("resetStoreInfo");

const resetInventoryRules = document.getElementById("resetInventoryRules");

const resetSukiSettings = document.getElementById("resetSukiSettings");

let pendingCategoryDelete = "";

let categoryManagementReturnFocus = null;

let categoryManagementScrollLocked = false;

let productImportRows = [];

let productImportFileData = null;

let productImportReturnFocus = null;

let resetDataReturnFocus = null;

let pendingRestoreData = null;

const BACKUP_FORMAT = "MiniMartPOS backup";

const fields = {
  storeName: document.getElementById("storeName"),
  address: document.getElementById("storeAddress"),
  contactNumber: document.getElementById("contactNumber"),
  registerName: document.getElementById("registerName"),
  receiptFooter: document.getElementById("receiptFooter"),
  timezone: document.getElementById("timezone"),
  dateFormat: document.getElementById("dateFormat"),
};

let logoDataUrl = "";

const currentSettings = window.miniMartSettings.get();

function showFieldError(fieldName, message) {
  const error = document.getElementById(`${fieldName}Error`);
  if (error) error.textContent = message;
  if (fields[fieldName]) fields[fieldName].setAttribute("aria-invalid", String(Boolean(message)));
}

function clearErrors() {
  Object.keys(fields).forEach((fieldName) => showFieldError(fieldName, ""));
  showFieldError("storeLogo", "");
}

function setStatus(message, isError = false) {
  settingsStatus.textContent = message;
  settingsStatus.className = `settings-status${isError ? " settings-status-error" : ""}`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function storeDateParts(date = new Date()) {
  const format = (timeZone) => new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  let parts;
  try {
    parts = format(window.miniMartSettings.get().timezone);
  } catch (error) {
    console.error("Invalid store timezone:", error);
    parts = format(window.miniMartSettings.defaults.timezone);
  }
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function storeDateString(date = new Date()) {
  const parts = storeDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function todayFilename(prefix, extension) {
  return `${prefix}-${storeDateString()}.${extension}`;
}

function reportFilename(dataType, extension) {
  const storeName = String(window.miniMartSettings.get().storeName || "MiniMart")
    .replace(/[^a-z0-9]/gi, "");
  const labels = {
    sales: "Sales",
    products: "Products",
    customers: "Customers",
    inventoryHistory: "Inventory_History",
  };
  return `${storeName || "MiniMart"}_${labels[dataType]}_${storeDateString()}.${extension}`;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function safeSpreadsheetText(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function resetSettingsSection(section) {
  if (!window.confirm("Reset this settings section to its defaults?")) {
    return;
  }
  const defaults = window.miniMartSettings.defaults;
  const changes = section === "store"
    ? {
        storeName: defaults.storeName,
        address: defaults.address,
        contactNumber: defaults.contactNumber,
        registerName: defaults.registerName,
        receiptFooter: defaults.receiptFooter,
        timezone: defaults.timezone,
        dateFormat: defaults.dateFormat,
        logoDataUrl: defaults.logoDataUrl,
      }
    : section === "inventory"
      ? {
          lowStockThreshold: defaults.lowStockThreshold,
          blockOutOfStockSales: defaults.blockOutOfStockSales,
        }
      : {
          sukiEnabled: defaults.sukiEnabled,
          sukiPesosPerPoint: defaults.sukiPesosPerPoint,
          sukiPesoValue: defaults.sukiPesoValue,
          sukiMinPointsToRedeem: defaults.sukiMinPointsToRedeem,
          sukiPointsExpiry: defaults.sukiPointsExpiry,
          sukiPointsExpiryDays: defaults.sukiPointsExpiryDays,
        };
  const { error, settings } = window.miniMartSettings.save(changes);
  if (error) {
    setBackupStatus("Could not reset that section.", true);
    return;
  }
  setFormValues(settings);
  setInventoryRulesValues(settings);
  setSukiSettingsValues(settings);
  updateThemeToggle(settings.theme);
  markSettingsClean();
  setStatus(section === "store" ? "Reset to defaults." : "");
  setInventoryRulesStatus(section === "inventory" ? "Reset to defaults." : "");
  setSukiSettingsStatus(section === "suki" ? "Reset to defaults." : "");
}

settingsTabs.forEach((tab) => {
  const activateTab = () => {
    const panelId = tab.dataset.settingsPanel;
    settingsTabs.forEach((button) => {
      const active = button === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll(".settings-card[role='tabpanel']").forEach((panel) => {
      panel.hidden = panel.id !== panelId;
    });
    document.getElementById(panelId)?.focus({ preventScroll: true });
  };
  tab.addEventListener("click", activateTab);
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const visibleTabs = settingsTabs.filter((button) => !button.hidden);
    const currentIndex = visibleTabs.indexOf(tab);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? visibleTabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + visibleTabs.length) % visibleTabs.length;
    visibleTabs[nextIndex]?.focus();
    visibleTabs[nextIndex]?.click();
  });
});

function updateSettingsSearch() {
  const query = settingsSearch.value.trim().toLowerCase();
  let visibleCount = 0;
  settingsTabs.forEach((tab) => {
    const panel = document.getElementById(tab.dataset.settingsPanel);
    const matches = !query ||
      `${tab.textContent} ${panel?.textContent || ""}`.toLowerCase().includes(query);
    tab.hidden = !matches;
    if (matches) visibleCount += 1;
    if (!matches && panel && !panel.hidden) {
      panel.hidden = true;
    }
  });
  settingsSearchEmpty.hidden = visibleCount > 0;
  if (query && visibleCount === 1) {
    const match = settingsTabs.find((tab) => !tab.hidden);
    if (match) match.click();
  } else if (!query) {
    const activeTab = settingsTabs.find((tab) => tab.classList.contains("is-active"));
    if (activeTab) {
      document.querySelectorAll(".settings-card[role='tabpanel']").forEach((panel) => {
        panel.hidden = panel.id !== activeTab.dataset.settingsPanel;
      });
    }
  }
}

settingsSearch.addEventListener("input", updateSettingsSearch);

resetStoreInfo.addEventListener("click", () => resetSettingsSection("store"));

resetInventoryRules.addEventListener("click", () => resetSettingsSection("inventory"));

resetSukiSettings.addEventListener("click", () => resetSettingsSection("suki"));

function settingsFormSnapshot() {
  return [storeInfoForm, inventoryRulesForm, sukiSettingsForm]
    .map((form) =>
      [...form.elements]
        .filter((element) => element.type !== "file")
        .map((element) => [element.name || element.id, element.type === "checkbox" ? element.checked : element.value]),
    );
}

let savedSettingsSnapshot = "";

let savedFormSnapshots = new Map();

function formSnapshot(form) {
  return JSON.stringify(
    [...form.elements]
      .filter((element) => element.type !== "file")
      .map((element) => [
        element.name || element.id,
        element.type === "checkbox" ? element.checked : element.value,
      ]),
  );
}

function updateUnsavedTabMarkers() {
  settingsTabs.forEach((tab) => {
    const panel = document.getElementById(tab.dataset.settingsPanel);
    const form = panel?.querySelector("form");
    tab.classList.toggle("has-unsaved-changes", Boolean(form?.classList.contains("has-unsaved-changes")));
  });
}

function markSettingsClean() {
  savedSettingsSnapshot = JSON.stringify(settingsFormSnapshot());
  savedFormSnapshots = new Map(
    [storeInfoForm, inventoryRulesForm, sukiSettingsForm].map((form) => [
      form,
      formSnapshot(form),
    ]),
  );
  document.querySelectorAll("form.has-unsaved-changes").forEach((form) => form.classList.remove("has-unsaved-changes"));
  updateUnsavedTabMarkers();
}

function hasUnsavedSettings() {
  return savedSettingsSnapshot !== JSON.stringify(settingsFormSnapshot());
}

[storeInfoForm, inventoryRulesForm, sukiSettingsForm].forEach((form) => {
  form.addEventListener("input", () => {
    form.classList.toggle("has-unsaved-changes", savedFormSnapshots.get(form) !== formSnapshot(form));
    updateUnsavedTabMarkers();
  });
  form.addEventListener("change", () => {
    form.classList.toggle("has-unsaved-changes", savedFormSnapshots.get(form) !== formSnapshot(form));
    updateUnsavedTabMarkers();
  });
});
