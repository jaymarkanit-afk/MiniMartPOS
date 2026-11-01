const settingsApi = window.miniMartSettings;
const mobileMenuButton = document.querySelector(".mobile-menu-button");
const mainNavigation = document.getElementById("mainNavigation");
const logoutButton = document.getElementById("logoutButton");
const mobileLogoutButton = document.getElementById("mobileLogoutButton");
const settings = settingsApi ? settingsApi.get() : {};

settingsApi?.applyTheme(settings);

let loadingOverlay;
let loadingMessage;
let loadingDetails;
let loadingRetry;
let loadingDismiss;
let loadingTimer;
let loadingSlowTimer;
let loadingActive = false;
let pageReady = false;

function ensureLoadingOverlay() {
  if (loadingOverlay || !document.body) return loadingOverlay;
  loadingOverlay = document.createElement("div");
  loadingOverlay.className = "loading-overlay";
  loadingOverlay.hidden = true;
  loadingOverlay.setAttribute("role", "status");
  loadingOverlay.setAttribute("aria-live", "polite");
  loadingOverlay.innerHTML = `
    <div class="loading-card">
      <div class="loading-spinner" aria-hidden="true"></div>
      <p class="loading-message">Loading...</p>
      <p class="loading-details" hidden></p>
      <div class="loading-actions" hidden>
        <button type="button" class="loading-retry">Retry</button>
        <button type="button" class="loading-dismiss">Dismiss</button>
      </div>
    </div>
  `;
  document.body.append(loadingOverlay);
  loadingMessage = loadingOverlay.querySelector(".loading-message");
  loadingDetails = loadingOverlay.querySelector(".loading-details");
  loadingRetry = loadingOverlay.querySelector(".loading-retry");
  loadingDismiss = loadingOverlay.querySelector(".loading-dismiss");
  loadingRetry.addEventListener("click", () => window.location.reload());
  loadingDismiss.addEventListener("click", () => hideLoading());
  return loadingOverlay;
}

function hideLoading() {
  if (!loadingOverlay) return;
  loadingActive = false;
  window.clearTimeout(loadingTimer);
  window.clearTimeout(loadingSlowTimer);
  loadingOverlay.hidden = true;
  loadingOverlay.classList.remove("is-slow", "is-error");
  if (loadingDetails) loadingDetails.hidden = true;
  if (loadingRetry?.parentElement) loadingRetry.parentElement.hidden = true;
}

function showLoading(message = "Loading...", options = {}) {
  ensureLoadingOverlay();
  if (!loadingOverlay) return false;
  loadingActive = true;
  loadingOverlay.hidden = false;
  loadingOverlay.classList.remove("is-error");
  loadingMessage.textContent = message;
  loadingDetails.hidden = true;
  loadingRetry.parentElement.hidden = true;
  window.clearTimeout(loadingSlowTimer);
  if (options.slow !== false) {
    loadingSlowTimer = window.setTimeout(() => {
      if (!loadingActive) return;
      loadingOverlay.classList.add("is-slow");
      loadingMessage.textContent = navigator.onLine === false
        ? "You are offline"
        : "Taking longer than usual. Check your connection.";
      loadingDetails.textContent = "You can retry or dismiss this message.";
      loadingDetails.hidden = false;
      loadingRetry.parentElement.hidden = false;
    }, options.slowAfter || 8000);
  }
  return true;
}

function showLoadingError(message) {
  ensureLoadingOverlay();
  if (!loadingOverlay) return;
  loadingOverlay.classList.add("is-error");
  loadingMessage.textContent = message || "Could not complete the action.";
  loadingDetails.hidden = true;
  loadingRetry.parentElement.hidden = true;
  loadingOverlay.hidden = false;
  loadingActive = true;
  window.clearTimeout(loadingTimer);
  loadingTimer = window.setTimeout(hideLoading, 5000);
}

async function withLoading(label, asyncFn, trigger = null) {
  if (trigger?.disabled) return undefined;
  if (trigger) trigger.disabled = true;
  showLoading(label);
  let failed = false;
  try {
    return await asyncFn();
  } catch (error) {
    failed = true;
    console.error(`Failed while ${label.toLowerCase()}:`, error);
    showLoadingError(`Could not complete: ${label.toLowerCase()}.`);
    throw error;
  } finally {
    if (trigger) trigger.disabled = false;
    if (!failed) hideLoading();
  }
}

window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.withLoading = withLoading;
window.miniMartPageReady = () => {
  pageReady = true;
  hideLoading();
};

function startPageLoading() {
  ensureLoadingOverlay();
  window.setTimeout(() => {
    if (!pageReady) showLoading("Loading...");
  }, 300);
  window.setTimeout(() => {
    if (!pageReady) window.miniMartPageReady();
  }, 15000);
}

startPageLoading();

if (window.miniMartInitialDataReady) window.miniMartPageReady();

window.addEventListener("miniMartAuthReady", window.miniMartPageReady);
if (window.miniMartAuthReady) window.miniMartPageReady();
window.addEventListener("pageshow", (event) => {
  if (event.persisted || pageReady) {
    pageReady = true;
    hideLoading();
  }
});

function showStorageWarning() {
  const database = window.miniMartDB;
  if (!database?.getStorageIssues?.().length || document.getElementById("storageWarning")) {
    return;
  }
  const banner = document.createElement("aside");
  banner.id = "storageWarning";
  banner.className = "storage-warning";
  banner.setAttribute("role", "alert");
  banner.innerHTML = `
    <strong>Some saved data could not be read.</strong>
    <span>A backup copy was saved. Check your browser storage before making changes.</span>
    <button type="button" aria-label="Dismiss storage warning">Dismiss</button>
  `;
  banner.querySelector("button").addEventListener("click", () => banner.remove());
  document.body.prepend(banner);
}

showStorageWarning();
window.addEventListener("storage-corrupt", showStorageWarning);

function applyStoreLogo(nextSettings) {
  const logoIsValid =
    nextSettings?.logoDataUrl &&
    settingsApi?.isValidLogoDataUrl(nextSettings.logoDataUrl);
  document.querySelectorAll(".brand-mark img").forEach((image) => {
    if (logoIsValid) {
      image.src = nextSettings.logoDataUrl;
      image.classList.add("custom-store-logo");
    } else {
      image.src = "Icons/grocery-store.png";
      image.classList.remove("custom-store-logo");
    }
  });
}

document.querySelectorAll(".suki-link").forEach((link) => {
  link.hidden = settings.sukiEnabled === false;
});

document.querySelectorAll(".date").forEach((element) => {
  element.textContent = settingsApi
    ? settingsApi.formatDate(new Date(), settings)
    : new Date().toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
});

document.querySelectorAll(".brand h1").forEach((element) => {
  element.textContent = settings.storeName || "Mini Mart";
});
document.querySelectorAll(".brand .eyebrow").forEach((element) => {
  element.textContent = settings.registerName || "REGISTER 01";
});
applyStoreLogo(settings);
window.addEventListener("miniMartSettingsChanged", (event) => {
  const nextSettings = event.detail || settingsApi?.get();
  settingsApi?.applyTheme(nextSettings);
  applyStoreLogo(nextSettings);
});
window.addEventListener("storage", (event) => {
  if (event.key === settingsApi?.SETTINGS_KEY) {
    applyStoreLogo(settingsApi.get());
  }
});

if (mobileMenuButton && mainNavigation) {
  mobileMenuButton.addEventListener("click", () => {
    const isOpen = mainNavigation.classList.toggle("is-open");
    mobileMenuButton.setAttribute("aria-expanded", String(isOpen));
  });

  mainNavigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      window.dispatchEvent(new Event("miniMartBeforeNavigate"));
      mainNavigation.classList.remove("is-open");
      mobileMenuButton.setAttribute("aria-expanded", "false");
    }
  });
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (
  !link ||
  event.defaultPrevented ||
  event.button !== 0 ||
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey ||
  link.target === "_blank" ||
  link.hasAttribute("download") ||
  link.getAttribute("href").startsWith("#") ||
  link.origin !== window.location.origin
  ) return;
  window.dispatchEvent(new Event("miniMartBeforeNavigate"));
  window.clearTimeout(loadingTimer);
  loadingTimer = window.setTimeout(() => showLoading("Loading..."), 300);
});

if (logoutButton || mobileLogoutButton) {
  const signOut = async (button) => {
    button.disabled = true;
    try {
      showLoading("Signing out...");
      if (window.supabaseClient) await window.supabaseClient.auth.signOut();
    } finally {
      window.location.replace("login.html");
    }
  };
  logoutButton?.addEventListener("click", () => signOut(logoutButton));
  mobileLogoutButton?.addEventListener("click", () =>
    signOut(mobileLogoutButton),
  );
}
