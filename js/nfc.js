"use strict";

let nfcReader = null;
let nfcReading = false;

function showNfcError(message, onError) {
  if (typeof onError === "function") {
    onError(message);
  }

  if (typeof window.showNfcToast === "function") {
    window.showNfcToast(message);
    return;
  }

  console.error(message);
}

window.isNfcSupported = function isNfcSupported() {
  return "NDEFReader" in window;
};

window.normalizeNfcId = function normalizeNfcId(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .trim()
    .toUpperCase()
    .replace(/-/g, ":")
    .replace(/\s+/g, "");
};

window.scanNfcCard = async function scanNfcCard(onCardDetected, onError) {
  if (!window.isNfcSupported()) {
    showNfcError("Web NFC is not supported in this browser.", onError);

    return;
  }

  if (nfcReading) {
    return;
  }

  try {
    nfcReading = true;

    nfcReader = new NDEFReader();

    await nfcReader.scan();

    console.log("NFC scanning started.");

    nfcReader.onreading = (event) => {
      const serialNumber = event.serialNumber;

      console.log("NFC Serial Number:", serialNumber);

      if (!serialNumber) {
        showNfcError(
          "Card detected, but no serial number was provided.",
          onError,
        );

        nfcReading = false;

        return;
      }

      const nfcId = window.normalizeNfcId(serialNumber);

      console.log("Normalized NFC ID:", nfcId);

      nfcReading = false;

      if (typeof onCardDetected === "function") {
        onCardDetected(nfcId);
      }
    };

    nfcReader.onreadingerror = () => {
      console.error("NFC reading error.");

      nfcReading = false;

      showNfcError("Could not read the NFC card. Try again.", onError);
    };
  } catch (error) {
    console.error("NFC start error:", error);

    nfcReading = false;

    showNfcError("Could not start NFC scanning: " + error.message, onError);
  }
};
