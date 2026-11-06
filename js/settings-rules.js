// Settings page: inventory rules.
function setInventoryRulesValues(settings) {
  lowStockThreshold.value = settings.lowStockThreshold;
  blockOutOfStockSales.checked = settings.blockOutOfStockSales !== false;
}

function setInventoryRulesStatus(message, isError = false) {
  inventoryRulesStatus.textContent = message;
  inventoryRulesStatus.className = `settings-status${isError ? " settings-status-error" : ""}`;
}

function validateInventoryRules() {
  const value = Number(lowStockThreshold.value);
  const valid = Number.isInteger(value) && value >= 0;
  lowStockThreshold.setAttribute("aria-invalid", String(!valid));
  document.getElementById("lowStockThresholdError").textContent = valid
    ? ""
    : "Enter a whole number of 0 or more.";
  return valid;
}

inventoryRulesForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setInventoryRulesStatus("");
  if (!validateInventoryRules()) return;

  const { error } = window.miniMartSettings.save({
    lowStockThreshold: Number(lowStockThreshold.value),
    blockOutOfStockSales: blockOutOfStockSales.checked,
  });

  if (error) {
    setInventoryRulesStatus("Could not save settings.", true);
    return;
  }

  setInventoryRulesStatus("Saved");
  markSettingsClean();
});
