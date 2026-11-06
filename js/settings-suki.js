// Settings page: Suki rules.
function setSukiSettingsValues(settings) {
  sukiEnabled.checked = settings.sukiEnabled !== false;
  sukiPesosPerPoint.value = settings.sukiPesosPerPoint;
  sukiPesoValue.value = settings.sukiPesoValue;
  sukiMinPointsToRedeem.value = settings.sukiMinPointsToRedeem;
  sukiPointsExpiry.value = settings.sukiPointsExpiry;
  sukiPointsExpiryDays.value = settings.sukiPointsExpiryDays;
  sukiPointsExpiryDaysField.hidden = settings.sukiPointsExpiry !== "days";
}

function setSukiSettingsStatus(message, isError = false) {
  sukiSettingsStatus.textContent = message;
  sukiSettingsStatus.className = `settings-status${isError ? " settings-status-error" : ""}`;
}

function validateSukiSettings() {
  const checks = [
    [sukiPesosPerPoint, Number(sukiPesosPerPoint.value) > 0, "Enter an amount greater than 0."],
    [sukiPesoValue, Number(sukiPesoValue.value) > 0, "Enter an amount greater than 0."],
    [
      sukiMinPointsToRedeem,
      Number.isInteger(Number(sukiMinPointsToRedeem.value)) &&
        Number(sukiMinPointsToRedeem.value) >= 0,
      "Enter a whole number of 0 or more.",
    ],
    [
      sukiPointsExpiryDays,
      sukiPointsExpiry.value !== "days" ||
        (Number.isInteger(Number(sukiPointsExpiryDays.value)) &&
          Number(sukiPointsExpiryDays.value) > 0),
      "Enter a whole number greater than 0.",
    ],
  ];
  let valid = true;
  checks.forEach(([field, isValid, message]) => {
    field.setAttribute("aria-invalid", String(!isValid));
    const error = document.getElementById(`${field.id}Error`);
    error.textContent = isValid ? "" : message;
    if (!isValid) valid = false;
  });
  return valid;
}

sukiPointsExpiry.addEventListener("change", () => {
  sukiPointsExpiryDaysField.hidden = sukiPointsExpiry.value !== "days";
});

sukiSettingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setSukiSettingsStatus("");
  if (!validateSukiSettings()) return;

  const { error } = window.miniMartSettings.save({
    sukiEnabled: sukiEnabled.checked,
    sukiPesosPerPoint: Number(sukiPesosPerPoint.value),
    sukiPesoValue: Number(sukiPesoValue.value),
    sukiMinPointsToRedeem: Number(sukiMinPointsToRedeem.value),
    sukiPointsExpiry: sukiPointsExpiry.value,
    sukiPointsExpiryDays: Number(sukiPointsExpiryDays.value),
  });

  if (error) {
    setSukiSettingsStatus("Could not save settings.", true);
    return;
  }

  setSukiSettingsStatus("Saved");
  markSettingsClean();
});
