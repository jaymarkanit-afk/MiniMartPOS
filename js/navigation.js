const mobileMenuButton = document.querySelector(".mobile-menu-button");
const mainNavigation = document.getElementById("mainNavigation");
const logoutButton = document.getElementById("logoutButton");

if (mobileMenuButton && mainNavigation) {
  mobileMenuButton.addEventListener("click", () => {
    const isOpen = mainNavigation.classList.toggle("is-open");
    mobileMenuButton.setAttribute("aria-expanded", String(isOpen));
  });

  mainNavigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      mainNavigation.classList.remove("is-open");
      mobileMenuButton.setAttribute("aria-expanded", "false");
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    try {
      if (window.supabaseClient) await window.supabaseClient.auth.signOut();
    } finally {
      window.location.replace("login.html");
    }
  });
}
