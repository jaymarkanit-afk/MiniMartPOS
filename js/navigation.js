const mobileMenuButton = document.querySelector(".mobile-menu-button");
const mainNavigation = document.getElementById("mainNavigation");
const logoutButton = document.getElementById("logoutButton");
const mobileLogoutButton = document.getElementById("mobileLogoutButton");

document.querySelectorAll(".date").forEach((element) => {
  element.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
});

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

if (logoutButton || mobileLogoutButton) {
  const signOut = async (button) => {
    button.disabled = true;
    try {
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
