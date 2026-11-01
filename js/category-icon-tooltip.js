"use strict";

function attachCategoryIconTooltip(button) {
  const label = button.dataset.label;
  if (!label) return;

  let tooltip = null;
  let hideTimer = null;

  const hide = () => {
    if (hideTimer) window.clearTimeout(hideTimer);
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  };

  const show = () => {
    hide();
    tooltip = document.createElement("span");
    tooltip.className = "category-icon-tooltip";
    tooltip.textContent = label;
    tooltip.setAttribute("role", "tooltip");
    document.body.append(tooltip);
    const buttonRect = button.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const gap = 8;
    const margin = 6;
    const left = Math.min(
      Math.max(buttonRect.left + (buttonRect.width - tooltipRect.width) / 2, margin),
      window.innerWidth - tooltipRect.width - margin,
    );
    const above = buttonRect.top - tooltipRect.height - gap;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(above, margin)}px`;
    if (above < margin) tooltip.classList.add("is-below");
  };

  button.addEventListener("mouseenter", show);
  button.addEventListener("mouseleave", hide);
  button.addEventListener("focusin", show);
  button.addEventListener("focusout", hide);
  button.addEventListener("pointerdown", () => {
    show();
    hideTimer = window.setTimeout(hide, 1400);
  });
}

window.attachCategoryIconTooltip = attachCategoryIconTooltip;
