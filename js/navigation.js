const mobileMenuButton = document.querySelector(".mobile-menu-button");
const mainNavigation = document.getElementById("mainNavigation");

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
