// Settings page: Excel and PDF exports.
function reportSales() {
  return window.miniMartDB.sales().filter((sale) => {
    const date = new Date(sale.date);
    if (Number.isNaN(date.getTime())) return false;
    const key = storeDateString(date);
    const today = storeDateString();
    if (salesRange.value === "all") return true;
    if (salesRange.value === "today") return key === today;
    if (salesRange.value === "last7") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 6);
      return key >= storeDateString(cutoff) && key <= today;
    }
    if (salesRange.value === "month") return key.slice(0, 7) === today.slice(0, 7);
    if (!salesStartDate.value || !salesEndDate.value) return false;
    return key >= salesStartDate.value && key <= salesEndDate.value;
  });
}

function reportData() {
  if (reportExportData.value === "sales") return reportSales();
  if (reportExportData.value === "products") return window.miniMartDB.products();
  return readBackupData().customers || [];
}

function reportRangeLabel() {
  const labels = { today: "Today", last7: "Last 7 days", month: "This month", all: "All time", custom: `${salesStartDate.value || "—"} to ${salesEndDate.value || "—"}` };
  return labels[salesRange.value];
}

function updateReportExportUi() {
  const isSales = reportExportData.value === "sales";
  const isCustomers = reportExportData.value === "customers";
  salesRangeField.hidden = !isSales;
  customDateFields.hidden = !isSales || salesRange.value !== "custom";
  customerExportNote.hidden = !isCustomers;
  const records = reportData();
  const validRange = !isSales || salesRange.value !== "custom" || (!salesStartDate.value || !salesEndDate.value || salesStartDate.value <= salesEndDate.value);
  reportExportSummary.textContent = `${records.length} records${isSales ? ` · ${reportRangeLabel()}` : ""}`;
  if (!validRange) {
    reportExportStatus.textContent = "Start date must be on or before end date.";
    reportExportStatus.className = "settings-status settings-status-error";
  }
  exportExcel.disabled = exportPdf.disabled = !records.length || !validRange;
}

function handleReportExportInput() {
  reportExportStatus.textContent = "";
  reportExportStatus.className = "settings-status";
  updateReportExportUi();
}

function formatExportDate(value) {
  return value ? window.miniMartSettings.formatDate(new Date(value)) : "";
}

function formatExportDateTime(value) {
  const settings = window.miniMartSettings.get();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: settings.timezone,
    year: "numeric",
    month: settings.dateFormat === "numeric" ? "2-digit" : "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function shortReceiptId(value) {
  const text = String(value || "");
  return text ? text.slice(-8).toUpperCase() : "—";
}

function salePaymentValue(sale, names) {
  for (const name of names) {
    const value = Number(sale[name]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function salesRows(sales) {
  const products = window.miniMartDB.products();
  const productMap = new Map(products.map((product) => [product.name, product]));
  const productsById = new Map(products.map((product) => [product.id, product]));
  const transactions = [];
  const items = [];
  const sortedSales = [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  sortedSales.forEach((sale) => {
    const saleItems = Array.isArray(sale.items) ? sale.items : [];
    let profit = 0;
    let hasCompleteCost = saleItems.length > 0;
    saleItems.forEach((item) => {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      const product = productsById.get(item.productId) || productMap.get(item.name);
      const recordedCost = Object.prototype.hasOwnProperty.call(item, "costPrice") ? item.costPrice : product?.costPrice;
      const cost = Number(recordedCost);
      const hasCost = Number.isFinite(cost);
      if (!hasCost) hasCompleteCost = false;
      if (hasCost) profit += (price - cost) * quantity;
      items.push({
        id: safeSpreadsheetText(sale.id || ""),
        date: formatExportDateTime(sale.date),
        product: safeSpreadsheetText(item.name || ""),
        category: safeSpreadsheetText(product?.category || item.category || ""),
        quantity,
        price,
        lineTotal: quantity * price,
        cost: hasCost ? cost : null,
        profit: hasCost ? (price - cost) * quantity : null,
      });
    });
    transactions.push({
      date: formatExportDateTime(sale.date),
      id: safeSpreadsheetText(sale.id || ""),
      receipt: shortReceiptId(sale.id),
      items: saleItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
      total: Number(sale.total) || 0,
      cash: salePaymentValue(sale, ["cashGiven", "cashPaid"]),
      change: salePaymentValue(sale, ["change", "changeAmount"]),
      profit: hasCompleteCost ? profit : null,
    });
  });
  return { transactions, items, missingCostSales: transactions.filter((sale) => sale.profit === null).length };
}

function reportWorkbook() {
  const dataType = reportExportData.value;
  const workbook = XLSX.utils.book_new();
  const settings = window.miniMartSettings.get();
  const styleHeader = (sheet, widths) => {
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]).e.r : 0), c: widths.length - 1 } }) };
    sheet["!cols"] = widths.map((width) => ({ wch: width }));
  };
  if (dataType === "sales") {
    const rows = salesRows(reportSales());
    const includePayment = rows.transactions.some((sale) => sale.cash !== null || sale.change !== null);
    const salesHeaders = ["Date & Time", "Transaction ID", "Items", "Total"];
    if (includePayment) salesHeaders.push("Cash", "Change");
    salesHeaders.push("Profit");
    const salesData = rows.transactions.map((sale) => [
      sale.date,
      sale.id,
      sale.items,
      sale.total,
      ...(includePayment ? [sale.cash ?? "—", sale.change ?? "—"] : []),
      sale.profit ?? "—",
    ]);
    const itemsData = rows.items.map((item) => [item.id, item.date, item.product, item.category, item.quantity, item.price, item.lineTotal, item.cost ?? "—", item.profit ?? "—"]);
    const totals = ["TOTAL", "", rows.transactions.reduce((sum, sale) => sum + sale.items, 0), rows.transactions.reduce((sum, sale) => sum + sale.total, 0)];
    if (includePayment) {
      totals.push(
        rows.transactions.every((sale) => sale.cash !== null) ? rows.transactions.reduce((sum, sale) => sum + sale.cash, 0) : "—",
        rows.transactions.every((sale) => sale.change !== null) ? rows.transactions.reduce((sum, sale) => sum + sale.change, 0) : "—",
      );
    }
    totals.push(rows.transactions.every((sale) => sale.profit !== null) ? rows.transactions.reduce((sum, sale) => sum + sale.profit, 0) : "—");
    const salesSheet = XLSX.utils.aoa_to_sheet([salesHeaders, ...salesData, totals]);
    const itemsSheet = XLSX.utils.aoa_to_sheet([["Transaction ID", "Date & Time", "Product", "Category", "Quantity", "Unit Price", "Line Total", "Cost", "Profit"], ...itemsData]);
    styleHeader(salesSheet, includePayment ? [22, 28, 10, 16, 16, 14, 16] : [22, 28, 10, 16, 16]);
    styleHeader(itemsSheet, [28, 22, 28, 18, 12, 16, 16, 14, 16]);
    salesSheet["!rows"] = [{ hpt: 22 }];
    const salesMoneyColumns = [3, ...(includePayment ? [4, 5] : []), includePayment ? 6 : 4];
    salesMoneyColumns.forEach((column) => { for (let row = 1; row <= rows.transactions.length + 1; row += 1) { const cell = salesSheet[XLSX.utils.encode_cell({ r: row, c: column })]; if (cell && typeof cell.v === "number") cell.z = "₱#,##0.00"; } });
    const itemMoneyColumns = [5, 6, 7, 8];
    itemMoneyColumns.forEach((column) => { for (let row = 1; row <= rows.items.length; row += 1) { const cell = itemsSheet[XLSX.utils.encode_cell({ r: row, c: column })]; if (cell && typeof cell.v === "number") cell.z = "₱#,##0.00"; } });
    XLSX.utils.book_append_sheet(workbook, salesSheet, "Sales");
    XLSX.utils.book_append_sheet(workbook, itemsSheet, "Items");
  } else if (dataType === "products") {
    const threshold = Number(settings.lowStockThreshold) || 0;
    const rows = reportData().map((product) => {
      const cost = Number(product.costPrice);
      const price = Number(product.price) || 0;
      return [safeSpreadsheetText(product.name || ""), safeSpreadsheetText(product.category || ""), Number.isFinite(cost) ? cost : null, price, Number.isFinite(cost) && price ? (price - cost) / price : null, Number(product.stock) || 0, Number(product.stock) <= threshold ? "Yes" : "No"];
    });
    const sheet = XLSX.utils.aoa_to_sheet([["Name", "Category", "Cost", "Price", "Margin %", "Stock", "Low Stock"], ...rows]);
    styleHeader(sheet, [30, 18, 14, 14, 14, 12, 14]);
    for (let row = 1; row <= rows.length; row += 1) {
      [2, 3].forEach((column) => {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
        if (cell) cell.z = "₱#,##0.00";
      });
      const margin = sheet[XLSX.utils.encode_cell({ r: row, c: 4 })];
      if (margin) margin.z = "0.00%";
    }
    XLSX.utils.book_append_sheet(workbook, sheet, "Products");
  } else {
    const rows = reportData().map((customer) => [safeSpreadsheetText(customer.name || ""), safeSpreadsheetText(customer.phone || ""), formatExportDate(customer.joined), customer.nfcId ? "Yes" : "No"]);
    const sheet = XLSX.utils.aoa_to_sheet([["Name", "Phone", "Date Joined", "Linked Card"], ...rows]);
    styleHeader(sheet, [28, 18, 18, 16]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Customers");
  }
  return workbook;
}

async function exportExcelReport() {
  exportExcel.disabled = exportPdf.disabled = true;
  exportExcel.textContent = "PREPARING…";
  try {
    const workbook = reportWorkbook();
    XLSX.writeFile(workbook, reportFilename(reportExportData.value, "xlsx"), { bookType: "xlsx" });
    reportExportStatus.textContent = "Excel report downloaded.";
    reportExportStatus.className = "settings-status";
  } catch (error) {
    console.error("Failed to export Excel report:", error);
    reportExportStatus.textContent = "Could not create the Excel report.";
    reportExportStatus.className = "settings-status settings-status-error";
  } finally {
    exportExcel.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4h11v16H4zM15 8h5v12h-5M8 8l3 4-3 4M11 8l-3 4 3 4" /></svg> EXPORT EXCEL';
    updateReportExportUi();
  }
}

function exportPdfReport() {
  exportExcel.disabled = exportPdf.disabled = true;
  exportPdf.textContent = "PREPARING…";
  try {
    const { jsPDF } = window.jspdf;
    const dataType = reportExportData.value;
    const doc = new jsPDF({ orientation: dataType === "sales" ? "landscape" : "portrait", unit: "mm", format: "a4" });
    const settings = window.miniMartSettings.get();
    doc.addFileToVFS("NotoSans-Regular.ttf", window.miniMartNotoSans);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    doc.setFont("NotoSans");
    const pageWidth = doc.internal.pageSize.getWidth();
    let headerY = 14;
    if (settings.logoDataUrl && window.miniMartSettings.isValidLogoDataUrl(settings.logoDataUrl)) {
      try {
        const format = settings.logoDataUrl.startsWith("data:image/png") ? "PNG" : settings.logoDataUrl.startsWith("data:image/webp") ? "WEBP" : "JPEG";
        doc.addImage(settings.logoDataUrl, format, 14, 8, 18, 18);
        headerY = 12;
      } catch (error) {
        console.warn("Could not add store logo to sales PDF:", error);
      }
    }
    const headerLeft = settings.logoDataUrl ? 36 : 14;
    doc.setFontSize(15);
    doc.setTextColor(24, 35, 29);
    doc.text(settings.storeName || "Mini Mart", headerLeft, headerY);
    doc.setFontSize(8);
    doc.setTextColor(80, 88, 83);
    const contact = [settings.address, settings.contactNumber].filter(Boolean).join(" · ");
    if (contact) doc.text(contact, headerLeft, headerY + 6);
    doc.setFontSize(12);
    doc.setTextColor(24, 35, 29);
    doc.text(`${dataType === "sales" ? "Sales" : dataType[0].toUpperCase() + dataType.slice(1)} Report`, 14, 32);
    doc.setFontSize(8);
    doc.setTextColor(80, 88, 83);
    doc.text(`Range: ${dataType === "sales" ? reportRangeLabel() : "All records"}`, 14, 38);
    doc.text(`Generated on: ${formatExportDateTime(new Date())}`, pageWidth - 14, 38, { align: "right" });
    let head;
    let body;
    if (dataType === "sales") {
      const rows = salesRows(reportSales());
      const includePayment = rows.transactions.some((sale) => sale.cash !== null || sale.change !== null);
      const totalProfitKnown = rows.transactions.every((sale) => sale.profit !== null);
      const itemsSold = rows.transactions.reduce((sum, sale) => sum + sale.items, 0);
      const revenue = rows.transactions.reduce((sum, sale) => sum + sale.total, 0);
      const profit = rows.transactions.reduce((sum, sale) => sum + (sale.profit || 0), 0);
      const summaryY = 45;
      doc.setFillColor(245, 247, 244);
      doc.roundedRect(14, summaryY, pageWidth - 28, 17, 2, 2, "F");
      doc.setFontSize(8);
      doc.setTextColor(24, 35, 29);
      const summary = [
        ["Transactions", String(rows.transactions.length)],
        ["Items sold", String(itemsSold)],
        ["Total revenue", window.miniMartSettings.formatCurrency(revenue)],
        ["Total profit", totalProfitKnown ? window.miniMartSettings.formatCurrency(profit) : "—"],
      ];
      summary.forEach(([label, value], index) => {
        const x = 18 + index * ((pageWidth - 36) / summary.length);
        doc.setTextColor(80, 88, 83);
        doc.text(label, x, summaryY + 6);
        doc.setTextColor(24, 35, 29);
        doc.text(value, x, summaryY + 12);
      });
      head = [["Date & time", "Receipt #", "Items", "Total"]];
      if (includePayment) head[0].push("Cash", "Change");
      head[0].push("Profit");
      body = rows.transactions.map((sale) => [
        sale.date,
        sale.receipt,
        sale.items,
        window.miniMartSettings.formatCurrency(sale.total),
        ...(includePayment ? [sale.cash === null ? "—" : window.miniMartSettings.formatCurrency(sale.cash), sale.change === null ? "—" : window.miniMartSettings.formatCurrency(sale.change)] : []),
        sale.profit === null ? "—" : window.miniMartSettings.formatCurrency(sale.profit),
      ]);
      const totals = ["TOTAL", "", itemsSold, window.miniMartSettings.formatCurrency(revenue)];
      if (includePayment) totals.push(rows.transactions.every((sale) => sale.cash !== null) ? window.miniMartSettings.formatCurrency(rows.transactions.reduce((sum, sale) => sum + sale.cash, 0)) : "—", rows.transactions.every((sale) => sale.change !== null) ? window.miniMartSettings.formatCurrency(rows.transactions.reduce((sum, sale) => sum + sale.change, 0)) : "—");
      totals.push(totalProfitKnown ? window.miniMartSettings.formatCurrency(profit) : "—");
      body.push(totals);
      const numericColumns = [2, 3, ...(includePayment ? [4, 5] : []), includePayment ? 6 : 4];
      const columnStyles = { 0: { cellWidth: 39 }, 1: { cellWidth: 22 } };
      numericColumns.forEach((column) => { columnStyles[column] = { halign: "right" }; });
      const missingNote = rows.missingCostSales ? `Profit excludes ${rows.missingCostSales} sale${rows.missingCostSales === 1 ? "" : "s"} with no cost data.` : "";
      doc.autoTable({
        startY: 66,
        head,
        body,
        theme: "striped",
        margin: { left: 14, right: 14, bottom: 16 },
        styles: { font: "NotoSans", fontSize: 7, cellPadding: 2.2, overflow: "linebreak", textColor: [65, 72, 67], lineColor: [225, 230, 226], lineWidth: 0.15 },
        headStyles: { fillColor: [24, 35, 29], textColor: [255, 255, 255], fontStyle: "normal", halign: "left" },
        columnStyles,
        didParseCell: (data) => {
          if (data.section === "head" && numericColumns.includes(data.column.index)) data.cell.styles.halign = "right";
          if (data.row.index === body.length - 1) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [232, 237, 233];
          }
          if (data.cell.text[0] === "—") data.cell.styles.textColor = [130, 136, 132];
        },
        rowPageBreak: "avoid",
        didDrawPage: (data) => {
          doc.setFontSize(8);
          doc.setTextColor(80, 88, 83);
          doc.text(settings.storeName || "Mini Mart", 14, doc.internal.pageSize.getHeight() - 8);
          doc.text(`Page ${data.pageNumber} of ${doc.getNumberOfPages()}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
        },
      });
      if (missingNote) {
        doc.setFontSize(7);
        doc.setTextColor(100, 106, 101);
        doc.text(missingNote, 14, doc.lastAutoTable.finalY + 7);
      }
      doc.save(reportFilename(dataType, "pdf"));
      reportExportStatus.textContent = "PDF report downloaded.";
      reportExportStatus.className = "settings-status";
      return;
    } else if (dataType === "products") {
      head = [["Name", "Category", "Cost (PHP)", "Price (PHP)", "Margin %", "Stock", "Low stock"]];
      const threshold = Number(settings.lowStockThreshold) || 0;
      body = reportData().map((product) => { const cost = Number(product.costPrice); const price = Number(product.price) || 0; return [product.name || "", product.category || "", Number.isFinite(cost) ? window.miniMartSettings.formatCurrency(cost) : "—", window.miniMartSettings.formatCurrency(price), Number.isFinite(cost) && price ? `${(((price - cost) / price) * 100).toFixed(1)}%` : "—", Number(product.stock) || 0, Number(product.stock) <= threshold ? "Yes" : "No"]; });
    } else {
      head = [["Name", "Phone", "Date Joined", "Linked Card"]];
      body = reportData().map((customer) => [customer.name || "", customer.phone || "", formatExportDate(customer.joined), customer.nfcId ? "Yes" : "No"]);
    }
    doc.autoTable({ startY: 45, head, body, theme: "striped", margin: { left: 14, right: 14, bottom: 16 }, styles: { font: "NotoSans", fontSize: 7, cellPadding: 2, overflow: "linebreak", textColor: [65, 72, 67] }, headStyles: { fillColor: [24, 35, 29], textColor: 255 }, didDrawPage: (data) => { doc.setFontSize(8); doc.setTextColor(80, 88, 83); doc.text(settings.storeName || "Mini Mart", 14, doc.internal.pageSize.getHeight() - 8); doc.text(`Page ${data.pageNumber} of ${doc.getNumberOfPages()}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" }); } });
    doc.save(reportFilename(dataType, "pdf"));
    reportExportStatus.textContent = "PDF report downloaded.";
    reportExportStatus.className = "settings-status";
  } catch (error) {
    console.error("Failed to export PDF report:", error);
    reportExportStatus.textContent = "Could not create the PDF report.";
    reportExportStatus.className = "settings-status settings-status-error";
  } finally {
    exportPdf.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6zM15 3v4h4M8 13h2a2 2 0 0 0 0-4H8v6M13 9h2a3 3 0 0 1 0 6h-2z" /></svg> EXPORT PDF';
    updateReportExportUi();
  }
}

function updateStockHistoryNotice() {
  const warning = window.miniMartDB.stockHistoryWarning();
  stockHistoryNotice.textContent = warning;
  stockHistoryNotice.hidden = !warning;
}

function markStockHistoryExported() {
  const result = window.miniMartDB.markStockHistoryExported();
  if (!result.ok) showStorageError(storageErrorMessage(result));
  updateStockHistoryNotice();
}

function exportInventoryHistoryFile() {
  const history = window.miniMartDB.stockHistory();
  if (!history) {
    setBackupStatus("Could not read inventory history.", true);
    return;
  }
  if (!history.length) {
    setBackupStatus("There is no inventory history to export.", true);
    return;
  }
  const rows = [
    ["Date", "Product", "Previous stock", "Adjustment", "Stock after", "Reason", "Source", "Reference"],
    ...history.map((entry) => [
      safeSpreadsheetText(entry.date || ""),
      safeSpreadsheetText(entry.product || ""),
      entry.previousStock ?? "",
      entry.adjustment ?? "",
      entry.stockAfter ?? "",
      safeSpreadsheetText(entry.reason || ""),
      safeSpreadsheetText(entry.source || ""),
      safeSpreadsheetText(entry.reference || ""),
    ]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [22, 30, 16, 14, 14, 18, 24, 26].map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Inventory History");
  XLSX.writeFile(workbook, reportFilename("inventoryHistory", "xlsx"));
  markStockHistoryExported();
  setBackupStatus(`Exported ${history.length} inventory history records.`);
}

reportExportData.addEventListener("change", handleReportExportInput);

salesRange.addEventListener("change", handleReportExportInput);

salesStartDate.addEventListener("change", handleReportExportInput);

salesEndDate.addEventListener("change", handleReportExportInput);

exportExcel.addEventListener("click", (event) =>
  window.withLoading?.("Preparing Excel report", () => exportExcelReport(), event.currentTarget),
);

exportPdf.addEventListener("click", (event) =>
  window.withLoading?.("Preparing PDF report", () => exportPdfReport(), event.currentTarget),
);

exportInventoryHistory.addEventListener("click", (event) =>
  window.withLoading?.(
    "Preparing inventory history",
    () => exportInventoryHistoryFile(),
    event.currentTarget,
  ),
);
