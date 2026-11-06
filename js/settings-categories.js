// Settings page: category management.
const categoryActionIcons = {
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6" /></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6 6 6-6" /></svg>',
  rename: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5V20h3.5L18 9.5 14.5 6 4 16.5Z" /><path d="m13 7.5 3.5 3.5" /></svg>',
  delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M9 7l1-2h4l1 2m-9 0 1 13h8l1-13" /></svg>',
};

const categoryIconOptions = window.miniMartDB.categoryIconOptions();

function setCategoryStatus(message, isError = false) {
  categoryManagementStatus.textContent = message;
  categoryManagementStatus.className = `category-management-modal-status${isError ? " is-error" : ""}`;
  window.clearTimeout(setCategoryStatus.timeout);
  if (message) {
    setCategoryStatus.timeout = window.setTimeout(() => {
      categoryManagementStatus.textContent = "";
    }, 1500);
  }
}

function getManagedCategories() {
  const products = window.miniMartDB.products();
  return [
    ...window.miniMartDB.categories(),
    ...new Set(products.map((product) => product.category)),
  ].filter((category, index, all) => all.indexOf(category) === index);
}

function renderCategorySummary(categories = getManagedCategories()) {
  categorySummaryChips.replaceChildren();
  document.getElementById("categoryManagementSummary").textContent =
    `${categories.length} categor${categories.length === 1 ? "y" : "ies"}`;
  categories.slice(0, 6).forEach((category) => {
    const chip = document.createElement("span");
    chip.className = "category-summary-chip";
    const icon = document.createElement("img");
    icon.src = window.miniMartDB.categoryIcon(category);
    icon.alt = "";
    const name = document.createElement("span");
    name.textContent = category;
    const unit = window.miniMartDB.categoryDefaultUnit(category);
    chip.append(icon, name);
    if (unit !== "piece") {
      const unitTag = document.createElement("small");
      unitTag.className = "category-summary-unit";
      unitTag.textContent = window.miniMartDB.units()[unit].shortLabel;
      chip.append(unitTag);
    }
    categorySummaryChips.append(chip);
  });
  if (categories.length > 6) {
    const more = document.createElement("span");
    more.className = "category-summary-chip category-summary-more";
    more.textContent = `+${categories.length - 6} more`;
    categorySummaryChips.append(more);
  }
}

function renderCategoryManagement() {
  categoryManagementList.replaceChildren();
  const categories = getManagedCategories();
  renderCategorySummary(categories);
  categoryManagementModalSummary.textContent =
    `${categories.length} categor${categories.length === 1 ? "y" : "ies"}`;
  const query = categoryManagementSearch.value.trim().toLowerCase();
  const visibleCategories = categories.filter((category) =>
    category.toLowerCase().includes(query),
  );
  categoryManagementEmpty.hidden = visibleCategories.length > 0;
  categoryManagementReorderNote.hidden = !query;
  if (!visibleCategories.length) {
    return;
  }

  visibleCategories.forEach((category) => {
    const index = categories.indexOf(category);
    const row = document.createElement("div");
    row.className = "category-management-row";
    row.dataset.category = category;
    row.draggable = !query;
    const productsCount = window.miniMartDB
      .products()
      .filter((product) => product.category === category).length;
    const icon = document.createElement("img");
    icon.src = window.miniMartDB.categoryIcon(category);
    icon.alt = "";
    icon.className = "category-management-icon";
    const name = document.createElement("button");
    name.type = "button";
    name.className = "category-management-name";
    name.dataset.categoryAction = "rename";
    name.textContent = category;
    name.setAttribute("aria-label", `Rename category ${category}`);
    const count = document.createElement("small");
    count.className = "category-management-count";
    count.textContent = `${productsCount} product${productsCount === 1 ? "" : "s"}`;
    const currentUnit = window.miniMartDB.categoryDefaultUnit(category);
    const unitTag = document.createElement("small");
    unitTag.className = "category-management-unit-tag";
    unitTag.textContent = currentUnit === "piece"
      ? ""
      : window.miniMartDB.units()[currentUnit].shortLabel;
    const details = document.createElement("span");
    details.className = "category-management-details";
    const unit = document.createElement("select");
    unit.className = "category-management-unit";
    unit.setAttribute("aria-label", `Default unit for ${category}`);
    Object.entries(window.miniMartDB.units()).forEach(([value, rule]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = `${rule.label} (${rule.shortLabel})`;
      option.selected = value === currentUnit;
      unit.append(option);
    });
    unit.addEventListener("change", () => {
      const result = window.miniMartDB.saveCategoryDefaultUnit(category, unit.value);
      if (!result?.ok) {
        unit.value = currentUnit;
        showStorageError(storageErrorMessage(result));
        return;
      }
      unitTag.textContent = unit.value === "piece"
        ? ""
        : window.miniMartDB.units()[unit.value].shortLabel;
      setCategoryStatus("Saved");
    });
    details.append(name, count);
    const unitEditor = document.createElement("div");
    unitEditor.className = "category-management-unit-editor";
    const unitLabel = document.createElement("small");
    unitLabel.textContent = "Default unit";
    unitEditor.append(unitLabel, unitTag, unit);
    const iconPicker = document.createElement("div");
    iconPicker.className = "category-management-icon-picker";
    iconPicker.setAttribute("aria-label", `Choose icon for ${category}`);
    const iconPickerLabel = document.createElement("small");
    iconPickerLabel.className = "category-management-icon-label";
    iconPickerLabel.textContent = "Choose category icon";
    iconPicker.append(iconPickerLabel);
    const currentIcon = window.miniMartDB.categoryIconId(category);
    categoryIconOptions.forEach(({ id, path, label }) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "category-icon-option";
      option.dataset.categoryIcon = id;
      option.dataset.category = category;
      option.dataset.label = label;
      option.title = label;
      option.setAttribute("aria-label", label);
      option.setAttribute("aria-pressed", String(id === currentIcon));
      if (id === currentIcon) option.classList.add("is-selected");
      const image = document.createElement("img");
      image.src = path;
      image.alt = label;
      option.append(image);
      window.attachCategoryIconTooltip(option);
      iconPicker.append(option);
    });
    const iconEditor = document.createElement("details");
    iconEditor.className = "category-management-icon-editor";
    const iconEditorSummary = document.createElement("summary");
    iconEditorSummary.textContent = "Change category icon";
    iconEditor.append(iconEditorSummary, iconPicker);
    const main = document.createElement("div");
    main.className = "category-management-main";
    main.append(icon, details);
    const editPanel = document.createElement("details");
    editPanel.className = "category-management-edit-panel";
    const editSummary = document.createElement("summary");
    editSummary.textContent = "Edit category";
    editPanel.append(editSummary);
    const actions = document.createElement("div");
    actions.className = "category-management-actions";
    actions.innerHTML = `
      <button class="settings-button-ghost" type="button" data-category-action="up" aria-label="Move category up" ${index === 0 ? "disabled" : ""}>${categoryActionIcons.up}</button>
      <button class="settings-button-ghost" type="button" data-category-action="down" aria-label="Move category down" ${index === categories.length - 1 ? "disabled" : ""}>${categoryActionIcons.down}</button>
      <button class="settings-button-ghost" type="button" data-category-action="rename" aria-label="Rename category">${categoryActionIcons.rename}</button>
      <button class="settings-button-ghost" type="button" data-category-action="delete" aria-label="Delete category">${categoryActionIcons.delete}</button>
    `;
    editPanel.append(unitEditor, iconEditor, actions);
    const error = document.createElement("small");
    error.className = "category-management-error";
    error.setAttribute("role", "alert");
    error.hidden = true;
    row.append(main, editPanel, error);
    categoryManagementList.append(row);
  });
}

function closeCategoryDeleteModal() {
  categoryDeleteModal.hidden = true;
  pendingCategoryDelete = "";
}

function openCategoryDeleteModal(category) {
  const products = window.miniMartDB
    .products()
    .filter((product) => product.category === category);
  const targets = getManagedCategories().filter((entry) => entry !== category);
  pendingCategoryDelete = category;
  categoryMoveTarget.replaceChildren();
  targets.forEach((target) => {
    const option = document.createElement("option");
    option.value = target;
    option.textContent = target;
    categoryMoveTarget.append(option);
  });
  categoryDeleteCopy.textContent = `${products.length} product${products.length === 1 ? "" : "s"} belong to ${category}. Choose another category so they are not orphaned.`;
  categoryMoveTarget.disabled = targets.length === 0;
  categoryDeleteModal.hidden = false;
  categoryMoveTarget.focus();
}

function saveCategoryRename(row) {
  const oldName = row.dataset.category;
  const input = row.querySelector(".category-management-edit");
  const newName = input.value.trim();
  const duplicate = getManagedCategories().some(
    (category) =>
      category !== oldName && category.toLowerCase() === newName.toLowerCase(),
  );
  if (!newName) {
    input.setAttribute("aria-invalid", "true");
    const error = row.querySelector(".category-management-error");
    error.textContent = "Category names cannot be empty.";
    error.hidden = false;
    return;
  }
  if (duplicate) {
    input.setAttribute("aria-invalid", "true");
    const error = row.querySelector(".category-management-error");
    error.textContent = "That category name already exists.";
    error.hidden = false;
    return;
  }
  if (newName === oldName) {
    renderCategoryManagement();
    setCategoryStatus("Saved");
    return;
  }
  window.miniMartDB.renameCategory(oldName, newName);
  renderCategoryManagement();
  setCategoryStatus("Saved");
}

function startCategoryRename(row) {
  if (row.querySelector(".category-management-edit")) return;
  const name = row.querySelector(".category-management-name");
  const input = document.createElement("input");
  input.className = "category-management-edit";
  input.type = "text";
  input.maxLength = 60;
  input.value = row.dataset.category;
  input.setAttribute("aria-label", `Rename category ${row.dataset.category}`);
  name.replaceWith(input);
  input.focus();
  input.select();
  const finish = () => {
    if (row.isConnected) saveCategoryRename(row);
  };
  input.addEventListener("blur", finish, { once: true });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      renderCategoryManagement();
    }
  });
}

function lockCategoryManagementScroll() {
  if (!categoryManagementScrollLocked) {
    document.body.dataset.categoryModalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    categoryManagementScrollLocked = true;
  }
}

function unlockCategoryManagementScroll() {
  if (categoryManagementScrollLocked) {
    document.body.style.overflow = document.body.dataset.categoryModalOverflow || "";
    delete document.body.dataset.categoryModalOverflow;
    categoryManagementScrollLocked = false;
  }
}

function openCategoryManagementModal() {
  categoryManagementReturnFocus = document.activeElement;
  categoryManagementSearch.value = "";
  renderCategoryManagement();
  categoryManagementModal.hidden = false;
  lockCategoryManagementScroll();
  categoryManagementSearch.focus();
}

function closeCategoryManagementModal() {
  categoryManagementModal.hidden = true;
  unlockCategoryManagementScroll();
  setCategoryStatus("");
  const returnTarget =
    categoryManagementReturnFocus?.isConnected &&
    typeof categoryManagementReturnFocus.focus === "function"
      ? categoryManagementReturnFocus
      : openCategoryManagement;
  returnTarget.focus();
  categoryManagementReturnFocus = null;
}

function keepCategoryManagementFocus(event) {
  if (event.key !== "Tab" || categoryManagementModal.hidden) return;
  const focusable = [
    ...categoryManagementModal.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

categoryManagementList.addEventListener("click", async (event) => {
  const iconButton = event.target.closest("[data-category-icon]");
  if (iconButton) {
    const category = iconButton.dataset.category;
    const result = window.miniMartDB.saveCategoryIcon(category, iconButton.dataset.categoryIcon);
    if (!result?.ok) {
      showStorageError(storageErrorMessage(result));
      return;
    }
    iconButton.closest(".category-management-icon-picker")
      .querySelectorAll("[data-category-icon]")
      .forEach((option) => {
        const selected = option === iconButton;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
    const rowIcon = iconButton.closest(".category-management-row").querySelector(".category-management-icon");
    rowIcon.src = window.miniMartDB.categoryIcon(category);
    renderCategorySummary();
    setCategoryStatus("Icon saved");
    return;
  }
  const button = event.target.closest("[data-category-action]");
  const row = event.target.closest(".category-management-row");
  if (!button || !row) return;
  const category = row.dataset.category;
  const action = button.dataset.categoryAction;

  if (action === "rename") {
    startCategoryRename(row);
    return;
  }
  if (action === "save") {
    saveCategoryRename(row);
    return;
  }
  if (action === "up" || action === "down") {
    if (categoryManagementSearch.value.trim()) {
      setCategoryStatus("Clear search to reorder.", true);
      return;
    }
    window.miniMartDB.moveCategory(category, action === "up" ? -1 : 1);
    renderCategoryManagement();
    setCategoryStatus("Saved");
    return;
  }
  if (action === "delete") {
    const hasProducts = window.miniMartDB
      .products()
      .some((product) => product.category === category);
    if (hasProducts) {
      openCategoryDeleteModal(category);
    } else if (await confirmDialog({
      title: `Delete the ${category} category?`,
      message: "It has no products, so none will be moved.",
      confirmLabel: "Delete category",
      cancelLabel: "Keep category",
      tone: "danger",
    })) {
      window.miniMartDB.deleteCategory(category);
      renderCategoryManagement();
      setCategoryStatus("Saved");
    }
  }
});

categoryManagementList.addEventListener("dragstart", (event) => {
  const row = event.target.closest(".category-management-row");
  if (!row || categoryManagementSearch.value.trim()) {
    event.preventDefault();
    return;
  }
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", row.dataset.category);
});

categoryManagementList.addEventListener("dragover", (event) => {
  const row = event.target.closest(".category-management-row");
  if (!row || categoryManagementSearch.value.trim()) return;
  event.preventDefault();
  row.classList.add("is-drag-over");
});

categoryManagementList.addEventListener("dragleave", (event) => {
  event.target.closest(".category-management-row")?.classList.remove("is-drag-over");
});

categoryManagementList.addEventListener("drop", (event) => {
  const row = event.target.closest(".category-management-row");
  const source = event.dataTransfer.getData("text/plain");
  if (!row || !source || source === row.dataset.category || categoryManagementSearch.value.trim()) return;
  event.preventDefault();
  const categories = getManagedCategories();
  const from = categories.indexOf(source);
  const to = categories.indexOf(row.dataset.category);
  categories.splice(to, 0, categories.splice(from, 1)[0]);
  const result = window.miniMartDB.saveCategories(categories);
  if (!result?.ok) {
    showStorageError(storageErrorMessage(result));
    return;
  }
  renderCategoryManagement();
  setCategoryStatus("Saved");
});

openCategoryManagement.addEventListener("click", openCategoryManagementModal);

closeCategoryManagement.addEventListener("click", closeCategoryManagementModal);

doneCategoryManagement.addEventListener("click", closeCategoryManagementModal);

categoryManagementSearch.addEventListener("input", () => {
  clearCategoryManagementSearch.hidden = !categoryManagementSearch.value;
  renderCategoryManagement();
});

clearCategoryManagementSearch.addEventListener("click", () => {
  categoryManagementSearch.value = "";
  clearCategoryManagementSearch.hidden = true;
  renderCategoryManagement();
  categoryManagementSearch.focus();
});

categoryManagementModal.addEventListener("click", (event) => {
  if (event.target === categoryManagementModal) closeCategoryManagementModal();
});

document.addEventListener("keydown", (event) => {
  if (categoryManagementModal.hidden) return;
  if (event.key === "Escape") {
    if (categoryDeleteModal.hidden) closeCategoryManagementModal();
    return;
  }
  keepCategoryManagementFocus(event);
});

document
  .getElementById("confirmCategoryDelete")
  .addEventListener("click", () => {
    if (!pendingCategoryDelete || !categoryMoveTarget.value) return;
    const { error } = window.miniMartDB.deleteCategory(
      pendingCategoryDelete,
      categoryMoveTarget.value,
    );
    if (error) {
      setCategoryStatus("Could not delete that category.", true);
      return;
    }
    closeCategoryDeleteModal();
    renderCategoryManagement();
    setCategoryStatus("Saved");
  });

document
  .getElementById("closeCategoryDelete")
  .addEventListener("click", closeCategoryDeleteModal);

document
  .getElementById("cancelCategoryDelete")
  .addEventListener("click", closeCategoryDeleteModal);

categoryDeleteModal.addEventListener("click", (event) => {
  if (event.target === categoryDeleteModal) closeCategoryDeleteModal();
});
