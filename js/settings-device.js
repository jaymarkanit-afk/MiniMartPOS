// Settings page: NFC device status and the USB card reader test.
let nfcPermissionStatus = null;
const USB_READER_TAPS_SHOWN = 5;
const usbReaderTest = document.getElementById("usbReaderTest");
const usbReaderStatus = document.getElementById("usbReaderStatus");
const usbReaderTaps = document.getElementById("usbReaderTaps");
let usbReaderTesting = false;

function usbReaderTapRow(tap) {
  const row = document.createElement("li");
  row.className = "usb-reader-tap";
  const text = document.createElement("code");
  text.textContent = tap.text;
  const lines = [
    `Length: ${tap.length}`,
    `All digits: ${tap.allDigits ? "yes" : "no"}`,
    `Average gap: ${tap.averageGap.toFixed(1)} ms`,
    `Gaps: ${tap.gaps.map((gap) => `${gap.toFixed(1)} ms`).join(", ") || "none"}`,
    `Ended with: ${tap.terminator}`,
    tap.recognized ? "Works as a card: yes" : `Works as a card: no. ${tap.problem}`,
  ];
  row.append(text);
  lines.forEach((line) => {
    const detail = document.createElement("p");
    detail.textContent = line;
    row.append(detail);
  });
  return row;
}

function toggleUsbReaderTest() {
  usbReaderTesting = !usbReaderTesting;
  usbReaderTest.textContent = usbReaderTesting ? "STOP TEST" : "TEST";
  if (!usbReaderTesting) {
    window.miniMartCardReader.stopTest();
    usbReaderStatus.textContent = "Test stopped. Press Test, then tap a card on the reader.";
    return;
  }
  usbReaderTest.blur();
  usbReaderStatus.textContent = "Testing. Tap a card on the reader now.";
  window.miniMartCardReader.startTest((tap) => {
    usbReaderStatus.textContent = "Tap received. Tap again, or press Stop test.";
    usbReaderTaps.prepend(usbReaderTapRow(tap));
    while (usbReaderTaps.children.length > USB_READER_TAPS_SHOWN) usbReaderTaps.lastElementChild.remove();
  });
}

usbReaderTest.addEventListener("click", toggleUsbReaderTest);

function setNfcStatusBadge(variant, icon, text) {
  nfcStatusBadge.className = `device-status-badge device-status-badge-${variant}`;
  nfcStatusBadge.querySelector("[aria-hidden]").textContent = icon;
  nfcStatusText.textContent = text;
}

function getNfcPermissionLabel(permission) {
  if (permission === "granted") return "granted";
  if (permission === "denied") return "denied";
  if (permission === "prompt") return "not asked";
  return "unknown";
}

async function checkNfcDeviceStatus(showConfirmation = false) {
  const supported = "NDEFReader" in window;
  const secure = window.isSecureContext;
  let permission = "unknown";

  if (supported && secure && navigator.permissions && typeof navigator.permissions.query === "function") {
    try {
      const status = await navigator.permissions.query({ name: "nfc" });
      permission = status.state;
      if (nfcPermissionStatus !== status) {
        if (nfcPermissionStatus) nfcPermissionStatus.removeEventListener("change", handleNfcPermissionChange);
        nfcPermissionStatus = status;
        nfcPermissionStatus.addEventListener("change", handleNfcPermissionChange);
      }
    } catch (error) {
      permission = "unknown";
    }
  }

  const permissionLabel = getNfcPermissionLabel(permission);
  nfcStatusDetails.textContent = `Browser support: ${supported ? "Yes" : "No"} · Secure connection: ${secure ? "Yes" : "No"} · Permission: ${permissionLabel}`;

  if (!secure) {
    setNfcStatusBadge("warning", "!", "Secure connection required");
    nfcStatusExplanation.textContent = "NFC needs a secure connection. Open Mini Mart POS over HTTPS or on localhost to check NFC availability.";
  } else if (!supported) {
    setNfcStatusBadge("neutral", "?", "Not supported");
    nfcStatusExplanation.textContent = "Web NFC only works in Chrome on an Android phone with NFC, over HTTPS. This device or browser can't read NFC cards. You can still use Suki Rewards by finding a customer by name or phone number.";
  } else if (permission === "granted") {
    setNfcStatusBadge("success", "✓", "Supported and allowed");
    nfcStatusExplanation.textContent = "NFC is ready to use. Make sure NFC is turned on in your phone settings.";
  } else if (permission === "prompt") {
    setNfcStatusBadge("warning", "!", "Supported, not asked yet");
    nfcStatusExplanation.textContent = "NFC is available. The browser will ask for permission the first time you scan a card on the Suki Rewards page.";
  } else if (permission === "denied") {
    setNfcStatusBadge("danger", "×", "Supported, but blocked");
    nfcStatusExplanation.textContent = "NFC access was blocked for this site. Open your browser's site settings, allow NFC for this site, then press Check again.";
  } else {
    setNfcStatusBadge("neutral", "?", "Unknown");
    nfcStatusExplanation.textContent = "The browser supports NFC, but it cannot report the current permission. Check your browser and device settings before scanning.";
  }

  if (showConfirmation) {
    nfcStatusConfirmation.textContent = "Checked just now";
    window.setTimeout(() => {
      nfcStatusConfirmation.textContent = "";
    }, 3000);
  }
}

function handleNfcPermissionChange() {
  checkNfcDeviceStatus();
}

checkNfcStatus.addEventListener("click", () => checkNfcDeviceStatus(true));
