"use strict";

function storageFailureReason(error) {
  if (error?.name === "QuotaExceededError" || error?.code === 22 || error?.code === 1014) {
    return "quota";
  }
  if (error?.name === "SecurityError" || error?.name === "InvalidStateError") {
    return "unavailable";
  }
  return "unknown";
}

function safeWrite(key, value, options = {}) {
  try {
    localStorage.setItem(key, options.raw ? String(value) : JSON.stringify(value));
    return { ok: true, error: null, reason: null };
  } catch (error) {
    return { ok: false, error, reason: storageFailureReason(error) };
  }
}

function showStorageError(message = "Could not save. Browser storage is unavailable or full. Export your data and clear old records.") {
  const toast = document.createElement("div");
  toast.className = "storage-error";
  toast.setAttribute("role", "alert");
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 6000);
}

function storageErrorMessage(result) {
  if (result?.reason === "quota") {
    return "Could not save. Browser storage is full. Export your data and clear old records.";
  }
  if (result?.reason === "unavailable") {
    return "Could not save. Browser storage is unavailable or blocked.";
  }
  return "Could not save. Please try again and check your browser storage settings.";
}

window.safeWrite = safeWrite;
window.showStorageError = showStorageError;
window.storageErrorMessage = storageErrorMessage;
