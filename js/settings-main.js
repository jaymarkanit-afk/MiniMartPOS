// Settings page: start-up. This loads last, so every file above it is ready.
renderCategoryManagement();

setFormValues(currentSettings);

setInventoryRulesValues(currentSettings);

setSukiSettingsValues(currentSettings);

updateThemeToggle(window.miniMartSettings.get().theme);

checkNfcDeviceStatus();

updateReportExportUi();

updateProductImportFileDisplay(Boolean(productImportFile.files?.length));

downloadProductErrors.hidden = true;

markSettingsClean();

updateBackupSummary();

updateStockHistoryNotice();

window.miniMartInitialDataReady = true;

window.addEventListener("beforeunload", (event) => {
  if (!hasUnsavedSettings()) return;
  event.preventDefault();
  event.returnValue = "";
});
