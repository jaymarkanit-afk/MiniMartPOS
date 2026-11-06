// Settings page: backup, restore, reset and the health check.
const BACKUP_VERSION = 2;

// Gives a safety backup's download time to start before the page reloads.
const RESTORE_RELOAD_DELAY_MS = 1000;

const backupKeys = {
  products: "miniMartProducts",
  sales: "miniMartSales",
  categories: "miniMartCategories",
  categoryIcons: "miniMartCategoryIcons",
  categoryUnits: "miniMartCategoryUnits",
  deletedProducts: "miniMartDeletedProducts",
  favoriteProducts: "miniMartFavoriteProducts",
  customers: "miniMartSukis",
  settings: "miniMartSettings",
  inventoryAdjustments: "miniMartInventoryAdjustments",
  shiftHistory: "miniMartShiftHistory",
  currentShift: "miniMartCurrentShift",
  heldCarts: "miniMartHeldCarts",
};

const backupShapes = {
  products: "records",
  sales: "records",
  categories: "strings",
  categoryIcons: "object",
  categoryUnits: "object",
  deletedProducts: "strings",
  favoriteProducts: "strings",
  customers: "records",
  settings: "object",
  inventoryAdjustments: "records",
  shiftHistory: "records",
  currentShift: "objectOrNull",
  heldCarts: "records",
};

const requiredBackupSections = ["products", "sales", "categories", "customers", "settings"];

function setBackupStatus(message, isError = false) {
  backupStatus.textContent = message;
  backupStatus.className = `settings-status${isError ? " settings-status-error" : ""}`;
}

function matchesBackupShape(value, shape) {
  if (shape === "records") return Array.isArray(value) && value.every(isPlainObject);
  if (shape === "strings") return Array.isArray(value) && value.every((entry) => typeof entry === "string");
  if (shape === "object") return isPlainObject(value);
  return value === null || isPlainObject(value);
}

function backupSectionFallback(name) {
  if (name === "settings") return window.miniMartSettings.get();
  if (name === "currentShift") return null;
  return backupShapes[name] === "object" ? {} : [];
}

function readBackupData(unreadable = []) {
  const data = {};
  Object.entries(backupKeys).forEach(([name, key]) => {
    data[name] = backupSectionFallback(name);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (matchesBackupShape(parsed, backupShapes[name])) data[name] = parsed;
      else unreadable.push(name);
    } catch (error) {
      console.error(`Could not read ${name} backup data:`, error);
      unreadable.push(name);
    }
  });
  return data;
}

// Throws if the file cannot be made. Unreadable sections are left out rather
// than saved as empty, so restoring the file cannot erase them.
function createBackupFile(prefix, { requireComplete = false } = {}) {
  const omitted = [];
  const data = readBackupData(omitted);
  if (requireComplete && omitted.length) {
    throw new Error(`Could not read: ${omitted.join(", ")}.`);
  }
  omitted.forEach((name) => delete data[name]);
  const exportedAt = new Date().toISOString();
  downloadFile(
    JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, omitted, data }, null, 2),
    todayFilename(prefix, "json"),
    "application/json",
  );
  const lastBackupResult = safeWrite("miniMartLastBackup", exportedAt, { raw: true });
  if (!lastBackupResult.ok) showStorageError(storageErrorMessage(lastBackupResult));
  if (!omitted.includes("inventoryAdjustments")) markStockHistoryExported();
  updateBackupSummary();
  return { omitted, lastBackupSaved: lastBackupResult.ok };
}

function downloadBackupFile() {
  try {
    const { omitted, lastBackupSaved } = createBackupFile("mini-mart-pos-backup");
    if (omitted.length) {
      setBackupStatus(`Backup downloaded without these unreadable sections: ${omitted.join(", ")}.`, true);
    } else if (!lastBackupSaved) {
      setBackupStatus("Backup downloaded, but its timestamp could not be saved.", true);
    } else {
      setBackupStatus("Backup downloaded.");
    }
  } catch (error) {
    console.error("Could not create backup:", error);
    setBackupStatus("Could not create the backup file. Please try again.", true);
  }
}

function updateBackupSummary() {
  const data = readBackupData();
  const lastBackup = localStorage.getItem("miniMartLastBackup");
  const lastBackupDate = lastBackup ? new Date(lastBackup) : null;
  const hasValidBackupDate = lastBackupDate && !Number.isNaN(lastBackupDate.getTime());
  const ageDays = hasValidBackupDate
    ? Math.floor((Date.now() - lastBackupDate.getTime()) / 86400000)
    : null;
  const ageWarning = ageDays === null
    ? lastBackup
      ? " Backup date is invalid."
      : " No backup recorded yet."
    : ageDays > 30
      ? ` Backup is ${ageDays} days old.`
      : "";
  backupSummary.textContent = `${data.products.length} products · ${data.sales.length} sales · ${data.customers.length} customers · ${data.inventoryAdjustments.length} stock adjustments${hasValidBackupDate ? ` · Last backup ${window.miniMartSettings.formatDate(lastBackupDate)}` : ""}${ageWarning}`;
  backupSummary.classList.toggle("is-warning", !hasValidBackupDate || ageDays > 30);
}

function showRestorePreview(data, filename) {
  const count = (name) => (data[name] || []).length;
  const hasProducts = Object.prototype.hasOwnProperty.call(data, "products");
  const kept = Object.keys(backupKeys).filter(
    (name) => !Object.prototype.hasOwnProperty.call(data, name) && !(hasProducts && name === "deletedProducts"),
  );
  pendingRestoreData = data;
  backupRestorePreviewText.textContent =
    `${filename}: ${count("products")} products, ${count("sales")} sales, ` +
    `${count("categories")} categories, ${count("customers")} customers, ` +
    `${count("inventoryAdjustments")} stock adjustments, ${count("shiftHistory")} closed shifts, ` +
    `${count("heldCarts")} held carts, and settings. A safety backup of your current data downloads first.` +
    (kept.length ? ` Not in this file, so left unchanged: ${kept.join(", ")}.` : "");
  backupRestorePreview.hidden = false;
  confirmRestoreBackup.focus();
}

function clearRestorePreview() {
  pendingRestoreData = null;
  backupRestorePreview.hidden = true;
  backupRestorePreviewText.textContent = "";
  restoreBackup.value = "";
}

function runHealthCheck() {
  const products = window.miniMartDB.products();
  const sales = window.miniMartDB.sales();
  const categories = window.miniMartDB.categories();
  const customers = readBackupData().customers;
  const categorySet = new Set(categories.map((category) => category.toLowerCase()));
  const duplicateProducts = products.length - new Set(products.map((product) => product.name.trim().toLowerCase())).size;
  const invalidProducts = products.filter((product) =>
    !product.name?.trim() ||
    !product.category?.trim() ||
    !categorySet.has(product.category.trim().toLowerCase()) ||
    !Number.isFinite(Number(product.price)) ||
    Number(product.price) < 0 ||
    !Number.isFinite(Number(product.stock)) ||
    Number(product.stock) < 0,
  ).length;
  const invalidSales = sales.filter((sale) =>
    !sale || !Array.isArray(sale.items) || !Number.isFinite(Number(sale.total)) ||
    !sale.items.every((item) => item?.name && Number.isFinite(Number(item.quantity))),
  ).length;
  const invalidCustomers = customers.filter((customer) => !customer || !customer.name?.trim()).length;
  const issues = [
    duplicateProducts ? `${duplicateProducts} duplicate product name${duplicateProducts === 1 ? "" : "s"}` : "",
    invalidProducts ? `${invalidProducts} invalid product record${invalidProducts === 1 ? "" : "s"}` : "",
    invalidSales ? `${invalidSales} invalid sale record${invalidSales === 1 ? "" : "s"}` : "",
    invalidCustomers ? `${invalidCustomers} invalid Suki customer${invalidCustomers === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  dataHealthResults.className = `data-health-results${issues.length ? " is-warning" : " is-healthy"}`;
  dataHealthResults.textContent = issues.length
    ? `Issues found: ${issues.join("; ")}.`
    : `Healthy: ${products.length} products, ${sales.length} sales, ${customers.length} customers, and ${categories.length} categories checked.`;
}

function resetDataCountsText() {
  resetDataCounts.textContent = `This will erase ${window.miniMartDB.products().length} products, ${window.miniMartDB.sales().length} sales, ${window.miniMartDB.categories().length} categories, ${readBackupData().customers.length} Suki customers, and ${readBackupData().inventoryAdjustments.length} stock adjustments. Settings and login will be kept.`;
}

function openResetDataModal() {
  resetDataReturnFocus = document.activeElement;
  resetDataCountsText();
  resetConfirmText.value = "";
  confirmResetData.disabled = true;
  resetDataStatus.textContent = "";
  resetDataModal.hidden = false;
  document.body.classList.add("modal-open");
  resetConfirmText.focus();
}

function closeResetDataModal() {
  resetDataModal.hidden = true;
  document.body.classList.remove("modal-open");
  if (resetDataReturnFocus && typeof resetDataReturnFocus.focus === "function") resetDataReturnFocus.focus();
}

function resetAllData() {
  try {
    createBackupFile("mini-mart-pos-pre-reset-backup", { requireComplete: true });
  } catch (error) {
    console.error("Could not create backup before reset:", error);
    resetDataStatus.textContent = `Automatic backup failed, so nothing was erased. ${error.message}`;
    resetDataStatus.className = "settings-status settings-status-error";
    return;
  }
  const oldValues =Object.fromEntries(["miniMartProducts", "miniMartSales", "miniMartCategories", "miniMartCategoryIcons", "miniMartDeletedProducts", "miniMartSukis", "miniMartInventoryAdjustments"].map((key) => [key, localStorage.getItem(key)]));
  try {
    const results = [
      ...["miniMartProducts", "miniMartSales", "miniMartCategories", "miniMartSukis", "miniMartInventoryAdjustments"].map((key) => safeWrite(key, [])),
      safeWrite("miniMartCategoryIcons", {}),
      // A seed product comes back unless it is listed as deleted.
      safeWrite("miniMartDeletedProducts", window.miniMartDB.seedProductNames()),
      safeWrite("miniMartStockHistoryExport", null, { remove: true }),
    ];
    const failed = results.find((result) => !result.ok);
    if (failed) throw failed.error;
    updateStockHistoryNotice();
    closeResetDataModal();
    setBackupStatus("All data was reset. Restore can bring it back from your backup file.");
    window.dispatchEvent(new CustomEvent("miniMartDatabaseChanged", { detail: { key: "miniMartProducts" } }));
  } catch (error) {
    console.error("Could not reset data:", error);
    Object.entries(oldValues).forEach(([key, value]) => { restoreRawValue(key, value); });
    resetDataStatus.textContent = "Could not reset data. Nothing was changed.";
    resetDataStatus.className = "settings-status settings-status-error";
  }
}

function backupValidationError(documentData) {
  if (documentData?.format !== BACKUP_FORMAT) return "this is not a Mini Mart backup.";
  const { version, data } = documentData;
  if (!Number.isInteger(version) || version < 1) return "its version number is not valid.";
  if (version > BACKUP_VERSION) return "it was made by a newer version of this app.";
  if (!isPlainObject(data)) return "it has no data section.";
  const hasSection = (name) => Object.prototype.hasOwnProperty.call(data, name);
  const omitted = Array.isArray(documentData.omitted) ? documentData.omitted : [];
  const missing = requiredBackupSections.find((name) => !hasSection(name) && !omitted.includes(name));
  if (missing) return `the "${missing}" section is missing.`;
  const broken = Object.keys(backupKeys).find((name) => {
    if (!hasSection(name)) return false;
    // Version 1 files saved categoryIcons as [] when no icons had been set.
    if (name === "categoryIcons" && version === 1 && Array.isArray(data[name]) && !data[name].length) return false;
    return !matchesBackupShape(data[name], backupShapes[name]);
  });
  return broken ? `the "${broken}" section has the wrong format.` : "";
}

function restoreRawValue(key, raw) {
  return raw === null
    ? safeWrite(key, null, { remove: true })
    : safeWrite(key, raw, { raw: true });
}

// Writes only the sections in the file. If a write fails, every key already
// changed is put back and the error is rethrown.
function restoreBackupData(backup) {
  const data = { ...backup };
  const hasSection = (name) => Object.prototype.hasOwnProperty.call(data, name);
  if (hasSection("products")) {
    data.inventoryAdjustments = window.miniMartDB.withStockChanges(
      hasSection("inventoryAdjustments")
        ? data.inventoryAdjustments
        : window.miniMartDB.stockHistory() || [],
      window.miniMartDB.stockChanges(window.miniMartDB.products(), data.products, { reason: "restore" }),
    ).slice(-window.miniMartDB.stockHistoryLimit());
    // The restored list is exactly the file's: seeds it lacks stay out, and nothing it has is hidden.
    const restoredNames = new Set(data.products.map((product) => product.name));
    data.deletedProducts = window.miniMartDB.seedProductNames().filter((name) => !restoredNames.has(name));
  }
  const writes = Object.keys(backupKeys)
    .filter(hasSection)
    .map((name) => ({
      key: backupKeys[name],
      value: name === "categoryIcons"
        ? window.miniMartDB.normalizeCategoryIcons(data[name])
        : data[name],
    }));
  const previous = writes.map(({ key }) => ({ key, raw: localStorage.getItem(key) }));
  for (const [index, { key, value }] of writes.entries()) {
    const result = value === null
      ? safeWrite(key, null, { remove: true })
      : safeWrite(key, value);
    if (!result.ok) {
      const unrestored = previous
        .slice(0, index)
        .reverse()
        .filter((entry) => !restoreRawValue(entry.key, entry.raw).ok)
        .map((entry) => entry.key);
      throw Object.assign(new Error(storageErrorMessage(result)), { unrestored });
    }
  }
  // An older file may have no product ids, so the one-time upgrades run again on reload.
  safeWrite("miniMartDataVersion", null, { remove: true });
}

async function confirmPendingRestore() {
  const data = pendingRestoreData;
  if (!data) return;
  try {
    createBackupFile("mini-mart-pos-pre-restore-backup", { requireComplete: true });
  } catch (error) {
    console.error("Could not create backup before restore:", error);
    clearRestorePreview();
    setBackupStatus(`Automatic backup failed, so the restore was stopped. Nothing was changed. ${error.message}`, true);
    return;
  }
  try {
    restoreBackupData(data);
  } catch (error) {
    console.error("Could not restore backup:", error);
    clearRestorePreview();
    setBackupStatus(
      error.unrestored?.length
        ? `Restore failed and these could not be put back: ${error.unrestored.join(", ")}. Restore the safety backup that just downloaded.`
        : `Restore failed, and your data was put back as it was. ${error.message}`,
      true,
    );
    return;
  }
  setBackupStatus("Backup restored. Reloading...");
  await new Promise((resolve) => window.setTimeout(resolve, RESTORE_RELOAD_DELAY_MS));
  window.location.reload();
}

document.getElementById("downloadBackup").addEventListener("click", (event) =>
  window.withLoading?.("Preparing backup", () => downloadBackupFile(), event.currentTarget),
);

openResetData.addEventListener("click", openResetDataModal);

closeResetData.addEventListener("click", closeResetDataModal);

cancelResetData.addEventListener("click", closeResetDataModal);

resetDataModal.addEventListener("click", (event) => {
  if (event.target === resetDataModal) closeResetDataModal();
});

resetConfirmText.addEventListener("input", () => {
  confirmResetData.disabled = resetConfirmText.value !== "RESET";
});

backupBeforeReset.addEventListener("click", () => {
  downloadBackupFile();
  resetDataStatus.textContent = backupStatus.textContent;
  resetDataStatus.className = backupStatus.className;
});

confirmResetData.addEventListener("click", resetAllData);

document.addEventListener("keydown", (event) => {
  if (!productImportModal.hidden) {
    if (event.key === "Escape") closeProductImportModal();
    productImportFocusTrap(event);
  }
  if (!resetDataModal.hidden && event.key === "Escape") closeResetDataModal();
});

restoreBackup.addEventListener("change", () => {
  const [file] = restoreBackup.files;
  if (!file) return;
  clearRestorePreview();
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch {
      setBackupStatus("That file is not valid JSON. Nothing was changed.", true);
      restoreBackup.value = "";
      return;
    }
    const validationError = backupValidationError(parsed);
    if (validationError) {
      setBackupStatus(`Invalid backup file: ${validationError} Nothing was changed.`, true);
      restoreBackup.value = "";
      return;
    }
    setBackupStatus("Review the preview, then restore or cancel.");
    showRestorePreview(parsed.data, file.name);
  });

  reader.addEventListener("error", () => {
    setBackupStatus("Could not read that backup file. Nothing was changed.", true);
    restoreBackup.value = "";
  });
  reader.readAsText(file);
});

// Keep the restore inside this click: browsers can silently hold a second
// download that has no user action behind it, with no error to detect.
confirmRestoreBackup.addEventListener("click", (event) =>
  window.withLoading?.("Restoring backup", confirmPendingRestore, event.currentTarget),
);

cancelRestoreBackup.addEventListener("click", () => {
  clearRestorePreview();
  setBackupStatus("Restore cancelled.");
});

runDataHealthCheck.addEventListener("click", runHealthCheck);
