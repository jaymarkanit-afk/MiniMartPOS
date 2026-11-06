// Settings page: light and dark mode.
function updateThemeToggle(theme) {
  const isDark = theme === "dark";
  themeToggle.setAttribute("aria-checked", String(isDark));
  themeToggle.classList.toggle("is-on", isDark);
  themeToggle.querySelector(".theme-toggle-icon").textContent = isDark ? "☾" : "☀";
}

themeToggle.addEventListener("click", () => {
  const isDark = themeToggle.getAttribute("aria-checked") === "true";
  const { error, settings } = window.miniMartSettings.save({
    theme: isDark ? "light" : "dark",
  });
  if (error) {
    themeToggle.focus();
    return;
  }
  window.miniMartSettings.applyTheme(settings);
  updateThemeToggle(settings.theme);
});
