// Settings page: store details and logo.
function updateStorePreviews() {
  receiptPreviewStore.textContent = fields.storeName.value.trim() || "Mini Mart";
  receiptPreviewContact.textContent =
    [fields.address.value.trim(), fields.contactNumber.value.trim()]
      .filter(Boolean)
      .join(" · ") || "No contact details";
  receiptPreviewFooter.textContent =
    fields.receiptFooter.value.trim() || "Receipt footer";
  if (logoDataUrl) {
    receiptPreviewLogo.src = logoDataUrl;
    receiptPreviewLogo.hidden = false;
  } else {
    receiptPreviewLogo.removeAttribute("src");
    receiptPreviewLogo.hidden = true;
  }
  datePreview.textContent = `Date preview: ${window.miniMartSettings.formatDate(new Date(), {
    timezone: fields.timezone.value,
    dateFormat: fields.dateFormat.value,
  })}`;
}

function updateBrandLogo() {
  document.querySelectorAll(".brand-mark img").forEach((image) => {
    image.src = logoDataUrl || "Icons/grocery-store.png";
    image.classList.toggle("custom-store-logo", Boolean(logoDataUrl));
  });
}

function setFormValues(settings) {
  Object.entries(fields).forEach(([fieldName, field]) => {
    field.value = settings[fieldName] ?? "";
  });
  logoDataUrl = settings.logoDataUrl || "";
  if (logoDataUrl && window.miniMartSettings.isValidLogoDataUrl(logoDataUrl)) {
    logoPreview.src = logoDataUrl;
    logoPreview.hidden = false;
    logoFileName.textContent = "Saved logo";
    removeLogo.hidden = false;
  } else {
    logoPreview.removeAttribute("src");
    logoPreview.hidden = true;
    logoFileName.textContent = "No file chosen";
    removeLogo.hidden = true;
  }
  updateBrandLogo();
  updateStorePreviews();
}

function validateForm() {
  clearErrors();
  let isValid = true;

  if (!fields.storeName.value.trim()) {
    showFieldError("storeName", "Store name is required.");
    isValid = false;
  }
  if (!fields.receiptFooter.value.trim()) {
    showFieldError("receiptFooter", "Receipt footer message is required.");
    isValid = false;
  }
  if (!fields.registerName.value.trim()) {
    showFieldError("registerName", "Register name is required.");
    isValid = false;
  }
  if (!fields.timezone.value) {
    showFieldError("timezone", "Choose a timezone.");
    isValid = false;
  }
  if (!fields.dateFormat.value) {
    showFieldError("dateFormat", "Choose a date format.");
    isValid = false;
  }

  return isValid;
}

[
  fields.storeName,
  fields.address,
  fields.contactNumber,
  fields.registerName,
  fields.receiptFooter,
].forEach((field) => field.addEventListener("input", updateStorePreviews));

[fields.timezone, fields.dateFormat].forEach((field) =>
  field.addEventListener("change", updateStorePreviews),
);

storeLogoInput.addEventListener("change", () => {
  const [file] = storeLogoInput.files;
  showFieldError("storeLogo", "");
  if (!file) {
    logoFileName.textContent = "No file chosen";
    return;
  }

  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    showFieldError("storeLogo", "Use a PNG, JPG, or WebP image.");
    storeLogoInput.value = "";
    logoFileName.textContent = "No file chosen";
    return;
  }
  if (file.size > maxLogoSize) {
    showFieldError("storeLogo", "Logo must be 200 KB or smaller.");
    storeLogoInput.value = "";
    logoFileName.textContent = "No file chosen";
    return;
  }

  logoFileName.textContent = file.name;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    if (typeof reader.result !== "string") {
      showFieldError("storeLogo", "Could not read that logo.");
      return;
    }
    logoDataUrl = reader.result;
    logoPreview.src = logoDataUrl;
    logoPreview.hidden = false;
    removeLogo.hidden = false;
    updateStorePreviews();
  });
  reader.addEventListener("error", () => {
    showFieldError("storeLogo", "Could not read that logo.");
  });
  reader.readAsDataURL(file);
});

removeLogo.addEventListener("click", () => {
  storeLogoInput.value = "";
  logoDataUrl = "";
  logoPreview.removeAttribute("src");
  logoPreview.hidden = true;
  logoFileName.textContent = "No file chosen";
  removeLogo.hidden = true;
  showFieldError("storeLogo", "");
  updateStorePreviews();
});

storeInfoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setStatus("");
  if (!validateForm()) return;

  const { error } = window.miniMartSettings.save({
    storeName: fields.storeName.value.trim(),
    address: fields.address.value.trim(),
    contactNumber: fields.contactNumber.value.trim(),
    registerName: fields.registerName.value.trim(),
    receiptFooter: fields.receiptFooter.value.trim(),
    timezone: fields.timezone.value,
    dateFormat: fields.dateFormat.value,
    logoDataUrl,
  });

  if (error) {
    setStatus("Could not save settings.", true);
    return;
  }

  updateBrandLogo();
  setStatus("Saved");
  markSettingsClean();
});
