// Settings page: product import.
function productTemplateFilename() {
  const storeName = String(window.miniMartSettings.get().storeName || "MiniMart").replace(/[^a-z0-9]/gi, "");
  return `${storeName || "MiniMart"}_Products_Template.xlsx`;
}

function styleTemplateHeader(sheet, columnCount) {
  for (let column = 0; column < columnCount; column += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "18231D" } },
      };
    }
  }
}

function downloadProductTemplateFile() {
  const workbook = XLSX.utils.book_new();
  const products = XLSX.utils.aoa_to_sheet([
    ["Name", "Category", "Cost", "Price", "Stock"],
    ["Example: Delete this row", "Snacks", 10, 12, 10],
    ["Example: Add your product", "Beverages", 20, 25, 5],
  ]);
  products["!freeze"] = { xSplit: 0, ySplit: 1 };
  products["!autofilter"] = { ref: "A1:E3" };
  products["!cols"] = [30, 20, 14, 14, 12].map((wch) => ({ wch }));
  styleTemplateHeader(products, 5);
  [2, 3].forEach((column) => {
    for (let row = 1; row <= 2; row += 1) {
      products[XLSX.utils.encode_cell({ r: row, c: column })].z = "₱#,##0.00";
    }
  });
  const instructions = XLSX.utils.aoa_to_sheet([
    ["Column", "Rule"],
    ["Name", "Required; trimmed; maximum 80 characters."],
    ["Category", "Optional only when following the existing Create Product category rule; match an existing category or choose to create missing categories."],
    ["Cost", "Number greater than or equal to 0. Peso signs, spaces, and thousands commas are accepted."],
    ["Price", "Number greater than or equal to 0. Peso signs, spaces, and thousands commas are accepted."],
    ["Stock", "Whole number greater than or equal to 0."],
    ["Examples", "Delete rows whose name starts with Example: before importing."],
  ]);
  instructions["!cols"] = [{ wch: 18 }, { wch: 90 }];
  instructions["!freeze"] = { xSplit: 0, ySplit: 1 };
  styleTemplateHeader(instructions, 2);
  XLSX.utils.book_append_sheet(workbook, products, "Products");
  XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
  XLSX.writeFile(workbook, productTemplateFilename(), { bookType: "xlsx", cellStyles: true });
  setBackupStatus("Product template downloaded.");
}

function importCellValue(cell) {
  if (!cell) return "";
  if (cell.f) return `=${cell.f}`;
  return cell.v ?? "";
}

function normalizeImportHeader(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseImportNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim().replace(/[₱,\s]/g, "");
  if (!text || /^[=+\-@]/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function productImportRowStatus(row) {
  if (row.error) return { label: `Error: ${row.error}`, className: "is-error" };
  if (row.duplicate) return { label: row.warning ? "Duplicate · Warning" : "Duplicate", className: "is-duplicate" };
  if (row.warning) return { label: "Warning", className: "is-warning" };
  return { label: "New", className: "is-new" };
}

function validateProductImportRows(rawRows) {
  const products = window.miniMartDB.products();
  const categories = window.miniMartDB.categories();
  const existingByName = new Map(products.map((product) => [product.name.trim().toLowerCase(), product]));
  const findExisting = (raw, name) => {
    const barcode = String(raw.barcode ?? "").trim();
    const id = String(raw.id ?? "").trim();
    const byBarcode = barcode && products.find((product) => String(product.barcode || "").trim() === barcode);
    if (byBarcode) return { product: byBarcode, matchedBy: "barcode" };
    const byId = id && products.find((product) => product.id === id);
    if (byId) return { product: byId, matchedBy: "id" };
    const byName = existingByName.get(name.toLowerCase());
    return byName ? { product: byName, matchedBy: "name" } : { product: null, matchedBy: null };
  };
  const seen = new Set();
  return rawRows.map((raw, index) => {
    const name = String(raw.name ?? "").trim();
    const categoryInput = String(raw.category ?? "").trim();
    const categoryMatch = categories.find((category) => category.toLowerCase() === categoryInput.toLowerCase());
    const cost = parseImportNumber(raw.cost);
    const price = parseImportNumber(raw.price);
    const stock = parseImportNumber(raw.stock);
    const row = {
      rowNumber: index + 2,
      name,
      category: categoryMatch || categoryInput,
      originalCategory: categoryInput,
      cost,
      price,
      stock,
      barcode: String(raw.barcode ?? "").trim(),
      duplicate: false,
      warning: false,
      error: "",
      existing: null,
      matchedBy: null,
    };
    if (!name) row.error = "Name is required.";
    else if (name.length > 80) row.error = "Name must be 80 characters or fewer.";
    else if (seen.has(name.toLowerCase())) row.error = "Duplicate in file.";
    else seen.add(name.toLowerCase());
    const match = findExisting(raw, name);
    if (!row.error && match.product) {
      row.duplicate = true;
      row.existing = match.product;
      row.matchedBy = match.matchedBy;
      // A name is the weakest match, so it gets a second look.
      if (match.matchedBy === "name") row.warning = true;
    }
    if (!row.error && categoryInput && !categoryMatch) row.newCategory = true;
    if (!row.error && !categoryInput) row.error = "Category is required.";
    if (!row.error && (cost === null || cost < 0)) row.error = "Cost must be a number 0 or greater.";
    if (!row.error && (price === null || price < 0)) row.error = "Price must be a number 0 or greater.";
    if (!row.error && (stock === null || !Number.isInteger(stock) || stock < 0)) row.error = "Stock must be a whole number 0 or greater.";
    if (!row.error && price < cost) row.warning = true;
    if (name.startsWith("Example:")) row.ignoreExample = true;
    return row;
  }).filter((row) => !row.ignoreExample);
}

function productImportCounts() {
  const rows = productImportRows;
  const errors = rows.filter((row) => row.error).length;
  const duplicates = rows.filter((row) => row.duplicate && !row.error).length;
  const warnings = rows.filter((row) => row.warning && !row.error).length;
  const newCount = rows.filter((row) => !row.error && !row.duplicate).length;
  return { errors, duplicates, warnings, newCount };
}

function productImportIsIncluded(row) {
  if (row.error) return false;
  if (!row.duplicate) return true;
  return productDuplicateMode.value === "update";
}

function productImportChangeText(row) {
  if (!row.duplicate || productDuplicateMode.value !== "update") return "—";
  const existing = row.existing;
  const values = [
    ["Cost", existing.costPrice, row.cost],
    ["Price", existing.price, row.price],
    ["Stock", existing.stock, row.stock],
    ["Category", existing.category, row.category],
  ].filter(([, oldValue, newValue]) => String(oldValue) !== String(newValue));
  return values.length ? values.map(([label, oldValue, newValue]) => `${label}: ${oldValue} → ${newValue}`).join("; ") : "No changes";
}

function renderProductImportPreview() {
  const filter = productImportFilter.value;
  const visible = productImportRows.filter((row) => {
    if (filter === "errors") return Boolean(row.error);
    if (filter === "duplicates") return row.duplicate;
    if (filter === "new") return !row.error && !row.duplicate;
    return true;
  });
  productImportPreview.innerHTML = visible.map((row) => {
    const status = productImportRowStatus(row);
    return `<tr class="${status.className}">
      <td data-label="Row">${row.rowNumber}</td>
      <td data-label="Name">${escapeHtml(row.name)}</td>
      <td data-label="Category">${escapeHtml(row.category || row.originalCategory)}${row.newCategory ? ' <span class="import-new-category">New category</span>' : ""}</td>
      <td data-label="Cost">${row.cost === null ? "—" : escapeHtml(row.cost)}</td>
      <td data-label="Price">${row.price === null ? "—" : escapeHtml(row.price)}</td>
      <td data-label="Stock">${row.stock === null ? "—" : escapeHtml(row.stock)}</td>
      <td data-label="Status"><span class="import-status">${escapeHtml(status.label)}</span></td>
      <td data-label="Will change">${escapeHtml(productImportChangeText(row))}</td>
    </tr>`;
  }).join("");
  productImportEmpty.hidden = visible.length > 0;
  const counts = productImportCounts();
  productImportSummary.textContent = `${counts.newCount} new, ${counts.duplicates} duplicates, ${counts.warnings} warnings, ${counts.errors} errors`;
  const validCount = productImportRows.filter(productImportIsIncluded).length;
  const updateCount = productImportRows.filter(
    (row) => row.duplicate && !row.error && productDuplicateMode.value === "update",
  ).length;
  confirmProductImport.textContent = updateCount
    ? `IMPORT ${validCount} · UPDATE ${updateCount}`
    : `IMPORT ${validCount} PRODUCT${validCount === 1 ? "" : "S"}`;
  productImportModalStatus.textContent = updateCount
    ? `${updateCount} existing product${updateCount === 1 ? "" : "s"} will be updated. Review the changes before confirming.`
    : "";
  productImportModalStatus.className = updateCount
    ? "settings-status settings-status-warning"
    : "settings-status";
  confirmProductImport.disabled = validCount === 0;
}

function setProductImportStatus(message, isError = false) {
  productImportStatus.textContent = message;
  productImportStatus.className = `settings-status${isError ? " settings-status-error" : ""}`;
}

function updateProductImportFileDisplay(hasFile) {
  productImportFileName.hidden = false;
  removeProductImportFile.hidden = !hasFile;
}

function downloadProductErrorRows() {
  const errors = productImportRows.filter((row) => row.error);
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Row", "Name", "Category", "Cost", "Price", "Stock", "Reason"],
    ...errors.map((row) => [row.rowNumber, row.name, row.category || row.originalCategory, row.cost ?? "", row.price ?? "", row.stock ?? "", row.error]),
  ]);
  sheet["!cols"] = [8, 30, 20, 14, 14, 12, 42].map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Errors");
  XLSX.writeFile(workbook, reportFilename("products", "xlsx").replace(".xlsx", "_Errors.xlsx"), { bookType: "xlsx" });
}

function setProductImportModalStatus(message, isError = false) {
  productImportModalStatus.textContent = message;
  productImportModalStatus.className = `settings-status${isError ? " settings-status-error" : ""}`;
}

function openProductImportModal() {
  productImportReturnFocus = document.activeElement;
  productImportModal.hidden = false;
  document.body.classList.add("modal-open");
  setProductImportModalStatus("");
  productImportFilter.value = "all";
  renderProductImportPreview();
  closeProductImport.focus();
}

function closeProductImportModal() {
  productImportModal.hidden = true;
  document.body.classList.remove("modal-open");
  if (productImportReturnFocus && typeof productImportReturnFocus.focus === "function") productImportReturnFocus.focus();
}

function productImportFocusable() {
  return [...productImportModal.querySelectorAll("button, select, input")].filter((element) => !element.disabled && !element.hidden);
}

function productImportFocusTrap(event) {
  if (productImportModal.hidden || event.key !== "Tab") return;
  const focusable = productImportFocusable();
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function parseProductImportFile(file) {
  if (!file) return;
  productImportFileData = null;
  downloadProductErrors.hidden = true;
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".xlsx")) {
    setProductImportStatus("Choose an .xlsx Excel file.", true);
    productImportFile.value = "";
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    setProductImportStatus("The file must be 2 MB or smaller.", true);
    productImportFile.value = "";
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const workbook = XLSX.read(reader.result, { type: "array", cellFormula: true, cellNF: false });
      const sheetName = workbook.SheetNames.includes("Products") ? "Products" : workbook.SheetNames[0];
      if (!sheetName) throw new Error("empty");
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
      if (range.e.r > 2000) {
        setProductImportStatus("The Products sheet must contain 2,000 data rows or fewer.", true);
        return;
      }
      const headers = [];
      for (let column = range.s.c; column <= range.e.c; column += 1) headers.push(normalizeImportHeader(importCellValue(sheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })])));
      const required = ["name", "category", "cost", "price", "stock"];
      const missing = required.filter((header) => !headers.includes(header) && header !== "category");
      if (missing.length) {
        setProductImportStatus(`Missing required header: ${missing[0][0].toUpperCase()}${missing[0].slice(1)}.`, true);
        return;
      }
      const rawRows = [];
      for (let rowIndex = range.s.r + 1; rowIndex <= range.e.r; rowIndex += 1) {
        const values = {};
        headers.forEach((header, column) => { if (header) values[header] = importCellValue(sheet[XLSX.utils.encode_cell({ r: rowIndex, c: range.s.c + column })]); });
        if (Object.values(values).some((value) => String(value).trim() !== "")) rawRows.push(values);
      }
      productImportRows = validateProductImportRows(rawRows);
      productImportFileData = { file, sheetName };
      productImportFileName.textContent = file.name;
      updateProductImportFileDisplay(true);
      openProductImportModal();
    } catch (error) {
      console.error("Could not parse product import:", error);
      setProductImportStatus("This file could not be read.", true);
    }
  });
  reader.addEventListener("error", () => setProductImportStatus("This file could not be read.", true));
  reader.readAsArrayBuffer(file);
}

function importProducts() {
  const counts = productImportCounts();
  const included = productImportRows.filter(productImportIsIncluded);
  if (productMissingCategoryMode.value === "uncategorized") {
    included.forEach((row) => {
      if (row.newCategory) row.category = "Uncategorized";
    });
  }
  const oldProducts = window.miniMartDB.products();
  const oldCategories = window.miniMartDB.categories();
  const oldCategoryIcons = localStorage.getItem("miniMartCategoryIcons");
  const oldDeletedProducts = localStorage.getItem("miniMartDeletedProducts");
  const oldStockHistory = localStorage.getItem("miniMartInventoryAdjustments");
  const byName = new Map(oldProducts.map((product) => [product.name.toLowerCase(), product]));
  const nextProducts = [...oldProducts];
  const nextCategories = [...oldCategories];
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  try {
    if (productDuplicateMode.value === "skip") skipped = counts.duplicates;
    included.forEach((row) => {
      const product = row.existing || byName.get(row.name.toLowerCase());
      const nextProduct = {
        ...(product || { id: window.miniMartDB.createProductId() }),
        ...(row.barcode ? { barcode: row.barcode } : {}),
        name: row.name,
        category: row.category,
        costPrice: row.cost,
        price: row.price,
        stock: row.stock,
        icon: product?.icon || "◇",
        accent: product?.accent || "var(--blue)",
      };
      if (product && productDuplicateMode.value === "update") {
        const index = nextProducts.findIndex((entry) => entry.id === product.id);
        nextProducts[index] = nextProduct;
        updated += 1;
      } else if (!product) {
        nextProducts.push(nextProduct);
        byName.set(row.name.toLowerCase(), nextProduct);
        imported += 1;
      }
      if (!nextCategories.some((category) => category.toLowerCase() === row.category.toLowerCase())) nextCategories.push(row.category);
    });
    if (productMissingCategoryMode.value === "uncategorized" && !nextCategories.includes("Uncategorized") && included.some((row) => row.newCategory)) nextCategories.push("Uncategorized");
    const deletedNames = oldDeletedProducts ? JSON.parse(oldDeletedProducts) : [];
    const importedNames = new Set(nextProducts.map((product) => product.name));
    const nextDeletedNames = deletedNames.filter((name) => !importedNames.has(name));
    const results = [
      window.miniMartDB.recordStockChange(
        window.miniMartDB.stockChanges(oldProducts, nextProducts, {
          reason: "import",
          source: productImportFileData?.file.name || "",
        }),
      ),
      safeWrite("miniMartProducts", nextProducts),
      safeWrite("miniMartCategories", nextCategories),
      safeWrite("miniMartDeletedProducts", nextDeletedNames),
    ];
    const failed = results.find((result) => !result.ok);
    if (failed) throw failed.error;
    productImportRows = productImportRows.map((row) => ({ ...row, imported: productImportIsIncluded(row) }));
    closeProductImportModal();
    setProductImportStatus(`Imported ${imported}, updated ${updated}, skipped ${skipped}, errors ${counts.errors}.`);
    downloadProductErrors.hidden = counts.errors === 0;
    window.dispatchEvent(new CustomEvent("miniMartDatabaseChanged", { detail: { key: "miniMartProducts" } }));
  } catch (error) {
    console.error("Could not import products:", error);
    restoreRawValue("miniMartInventoryAdjustments", oldStockHistory);
    safeWrite("miniMartProducts", oldProducts);
    safeWrite("miniMartCategories", oldCategories);
    if (oldCategoryIcons !== null) {
      try {
        safeWrite(
          "miniMartCategoryIcons",
          window.miniMartDB.normalizeCategoryIcons(
            JSON.parse(oldCategoryIcons),
          ),
        );
      } catch {
        safeWrite("miniMartCategoryIcons", oldCategoryIcons, { raw: true });
      }
    }
    if (oldDeletedProducts !== null) safeWrite("miniMartDeletedProducts", oldDeletedProducts, { raw: true });
    setProductImportModalStatus("Could not save products. Nothing was changed.", true);
  }
}

downloadProductTemplate.addEventListener("click", downloadProductTemplateFile);

productImportFile.addEventListener("change", () => parseProductImportFile(productImportFile.files[0]));

removeProductImportFile.addEventListener("click", () => {
  productImportFile.value = "";
  productImportFileData = null;
  productImportRows = [];
  productImportFileName.textContent = "No file chosen";
  updateProductImportFileDisplay(false);
  downloadProductErrors.hidden = true;
  setProductImportStatus("");
});

productDuplicateMode.addEventListener("change", renderProductImportPreview);

productMissingCategoryMode.addEventListener("change", renderProductImportPreview);

productImportFilter.addEventListener("change", renderProductImportPreview);

confirmProductImport.addEventListener("click", (event) =>
  window.withLoading?.("Importing products", () => importProducts(), event.currentTarget),
);

downloadProductErrors.addEventListener("click", downloadProductErrorRows);

closeProductImport.addEventListener("click", closeProductImportModal);

cancelProductImport.addEventListener("click", closeProductImportModal);

productImportModal.addEventListener("click", (event) => {
  if (event.target === productImportModal) closeProductImportModal();
});
