"use strict";
// Each mutation reverts one fix, in memory only. `tests` must fail while it is applied.
// A test that cannot fail is not proof, so node tests/mutate.js checks every one of these.
const mutations = [
  {
    id: "stale-line-total",
    fix: "A fixed-price line is priced from its quantity (4ade2e6)",
    tests: ["checkout: a held cart with a stale line total is priced from its quantity"],
    edits: [{
      file: "js/checkout.js",
      from: "return measuredUnit(item.unit) && item.lineTotal !== undefined",
      to: "return item.lineTotal !== undefined",
    }],
  },
  {
    id: "reward-ignores-points",
    fix: "One reward amount for screen and sale, limited by the points (a165fe2)",
    tests: ["checkout: no more than the points are worth can be spent"],
    edits: [{
      file: "js/checkout.js",
      from: "Math.min(requested, sukiRules.maxRedeemAmount(points, total))",
      to: "requested",
    }],
  },
  {
    id: "draft-drops-line-total",
    fix: "Measured drafts save the running total (f9ecd73)",
    tests: ["measured-draft: uneven amounts keep their exact values"],
    edits: [{
      file: "js/checkout.js",
      from: "      lineTotal: item.lineTotal,\n      unit: item.unit || \"piece\",",
      to: "      unit: item.unit || \"piece\",",
    }],
  },
  {
    id: "measured-keeps-last-amount",
    fix: "Measured lines keep the running total, not the last entry (f9ecd73, fully reverted)",
    tests: ["measured-draft: two amounts survive a reload", "measured-draft: editing a combined line shows the full amount"],
    edits: [
      {
        file: "js/checkout.js",
        from: "      lineTotal: item.lineTotal,\n      unit: item.unit || \"piece\",",
        to: "      unit: item.unit || \"piece\",",
      },
      {
        file: "js/checkout.js",
        from: "item.amountMode = measuredMode === \"amount\" || (!measuredEditId && Boolean(item.amountMode));\n  item.inputValue = String(item.amountMode ? item.lineTotal : item.quantity);",
        to: "item.amountMode = measuredMode === \"amount\";\n  item.inputValue = measureValue.value;",
      },
    ],
  },
  {
    id: "draft-kept-after-sale",
    fix: "A finished sale clears the draft",
    tests: ["cart-draft: a finished sale clears the draft and it stays cleared"],
    edits: [{
      file: "js/checkout.js",
      from: "  updatePaymentMethodUI();\n  clearCheckoutDraft();\n",
      to: "  updatePaymentMethodUI();\n",
    }],
  },
  {
    id: "no-premigration-backup",
    fix: "Suki migration backs up the original list first",
    tests: ["suki-store: the original list is backed up once, exactly"],
    edits: [{
      file: "js/suki-store.js",
      from: "!saveOneTimeBackup(PREMIGRATION_PREFIX, stored.raw) ||",
      to: "false ||",
    }],
  },
  {
    id: "no-shrink-guard",
    fix: "Saves that lose customers are refused",
    tests: ["suki-store: saves that would lose customers are refused", "suki-store: a stale tab cannot drop a customer added elsewhere"],
    edits: [{ file: "js/suki-store.js", from: "if (lost.size) {", to: "if (false) {" }],
  },
  {
    id: "backup-filename-utc",
    fix: "Backup filename uses the store timezone",
    tests: ["backup: backup filename uses the store timezone, not the computer's"],
    edits: [{
      file: "js/settings-core.js",
      from: "return `${prefix}-${storeDateString()}.${extension}`;",
      to: "return `${prefix}-${new Date().toISOString().slice(0, 10)}.${extension}`;",
    }],
  },
  {
    id: "no-restore-rollback",
    fix: "A failed restore puts every key back",
    tests: ["backup: a restore that fails part way puts every key back"],
    edits: [{
      file: "js/settings-data.js",
      from: ".filter((entry) => !restoreRawValue(entry.key, entry.raw).ok)",
      to: ".filter(() => false)",
    }],
  },
  {
    id: "no-backup-before-reset",
    fix: "Reset backs up first",
    tests: ["backup: reset downloads a backup first, then erases", "backup: reset stops and erases nothing if the automatic backup fails"],
    edits: [{
      file: "js/settings-data.js",
      from: "createBackupFile(\"mini-mart-pos-pre-reset-backup\", { requireComplete: true });",
      to: "",
    }],
  },
  {
    id: "no-backup-shape-check",
    fix: "Broken backup files are rejected",
    tests: ["backup: broken backup files are rejected and nothing is written"],
    edits: [{
      file: "js/settings-data.js",
      from: "return !matchesBackupShape(data[name], backupShapes[name]);",
      to: "return false;",
    }],
  },
  {
    id: "no-false-corruption-cleanup",
    fix: "False corruption backups are removed on load",
    tests: ["corruption: false corruption backups are removed on load"],
    edits: [{
      file: "js/database.js",
      from: "\nremoveFalseCorruptBackups();\nrunDataMigrations();",
      to: "\nrunDataMigrations();",
    }],
  },
  {
    id: "no-corruption-dedupe",
    fix: "The same corruption is backed up once",
    tests: ["corruption: the same corruption is backed up once and a change is backed up again"],
    edits: [{
      file: "js/database.js",
      from: "if (existing.length && localStorage.getItem(existing[0]) === raw) return \"saved\";",
      to: "",
    }],
  },
  {
    id: "stock-write-no-undo",
    fix: "Stock and history are written atomically",
    tests: ["stock-history: if stock cannot be written, the history entry is rolled back"],
    edits: [{ file: "js/database.js", from: "if (!productsResult.ok) undo();", to: "" }],
  },
  {
    id: "products-always-write",
    fix: "products() is read-only unless normalization changed data",
    tests: ["stock-history: reading the app writes no products or history"],
    edits: [{ file: "js/database.js", from: "JSON.stringify(products) !== productsResult.raw", to: "true" }],
  },
  {
    id: "missing-date-expires",
    fix: "Missing dates never remove points (1d74e6e)",
    tests: ["expiry: with expiry on, only customers with real old dates lose points", "expiry: the rule treats missing dates as not expired"],
    edits: [{
      file: "js/suki-rules.js",
      from: "if (pointsEntryDate === null || pointsEntryDate === undefined) return null;",
      to: "",
    }],
  },
  {
    id: "cart-icon-in-picker",
    fix: "The cart icon is not in the picker",
    tests: ["icons: Inventory picker shows exactly the 14 icons, with no cart and none broken"],
    edits: [{
      file: "js/database.js",
      from: "  sweets: { path: \"Icons/sweets.png\", label: \"Sweets\" },\n});",
      to: "  sweets: { path: \"Icons/sweets.png\", label: \"Sweets\" },\n  groceryStore: { path: \"Icons/grocery-store.png\", label: \"Cart\" },\n});",
    }],
  },
  {
    id: "no-legacy-cart-alias",
    fix: "Old cart ids move to the right PNG",
    tests: ["icons: old icon ids and paths move to the right PNG and stay there after two reloads"],
    edits: [{ file: "js/database.js", from: "  groceryStore: \"cannedFood\",\n", to: "" }],
  },
  {
    id: "tooltip-no-focus",
    fix: "The tooltip works from the keyboard",
    tests: ["icons: Inventory tooltip shows the right label on keyboard focus", "icons: Settings tooltip shows the right label on keyboard focus"],
    edits: [{ file: "js/category-icon-tooltip.js", from: "button.addEventListener(\"focusin\", show);", to: "" }],
  },
  {
    id: "category-rows-squeezed",
    fix: "Manage Categories rows keep their full height",
    tests: [
      "icons: Manage categories: all 16 rows are reachable by mouse at 1366x650",
      "icons: Manage categories: all 16 rows are reachable by mouse at 1264x805",
      "icons: Manage categories: all 16 rows are reachable by mouse at 1920x1040",
      "icons: Manage categories: a mouse click on an icon saves it",
      "icons: Settings tooltip shows the right label on hover",
    ],
    edits: [{ file: "css/settings.css", from: "  grid-auto-rows: max-content;\n  align-content: start;\n", to: "" }],
  },
  {
    id: "empty-message-always-on",
    fix: "The empty message respects hidden",
    tests: ["icons: Manage categories: the empty message is hidden while categories are listed"],
    edits: [{ file: "css/settings.css", from: ".category-management-empty[hidden] {\n  display: none;\n}\n", to: "" }],
  },
  {
    id: "sold-out-counted-twice",
    fix: "A sold-out item is counted once",
    tests: ["cart-draft: a sold-out item is removed and counted once"],
    edits: [{
      file: "js/checkout.js",
      from: "    if (clamped <= 0) {\n      return;",
      to: "    if (clamped <= 0) {\n      adjusted += 1;\n      return;",
    }],
  },
  {
    id: "icon-alias-inherited-names",
    fix: "Icon lookups ignore inherited names",
    tests: [
      "icons: a tampered icon value falls back and injects nothing: \"constructor\"",
      "icons: a tampered icon value falls back and injects nothing: \"__proto__\"",
      "icons: a tampered icon value falls back and injects nothing: \"toString\"",
    ],
    edits: [{
      file: "js/database.js",
      from: "ownValue(CATEGORY_ICON_LEGACY_ALIASES, storedIcon)",
      to: "CATEGORY_ICON_LEGACY_ALIASES[storedIcon]",
    }],
  },
  {
    id: "icon-path-inherited-names",
    fix: "Icon lookups ignore inherited names",
    tests: ["icons: a tampered icon value falls back and injects nothing: \"valueOf\""],
    edits: [{
      file: "js/database.js",
      from: "ownValue(CATEGORY_ICON_PATH_TO_ID, storedIcon)",
      to: "CATEGORY_ICON_PATH_TO_ID[storedIcon]",
    }],
  },
  {
    id: "no-icon-remigration",
    fix: "Stores that already ran the migration are cleaned too",
    tests: ["icons: a tampered icon in a store that already ran the old migration is cleaned too"],
    edits: [{ file: "js/database.js", from: "const DATA_VERSION = 3;", to: "const DATA_VERSION = 1;" }],
  },
  {
    id: "favicon-dead-link",
    fix: "Each page declares an icon that exists",
    tests: ["pages: index declares an icon that loads"],
    edits: [{
      file: "index.html",
      from: "<link rel=\"icon\" type=\"image/png\" href=\"Icons/grocery-store.png\" />",
      to: "<link rel=\"icon\" type=\"image/png\" href=\"Icons/missing.png\" />",
    }],
  },
  {
    id: "favicon-removed",
    fix: "Each page declares an icon that exists",
    tests: ["pages: login declares an icon that loads", "requests: no app request failed at any point in the run"],
    edits: [{
      file: "login.html",
      from: "<link rel=\"icon\" type=\"image/png\" href=\"Icons/grocery-store.png\" />",
      to: "",
    }],
  },
  {
    id: "reset-brings-seeds-back",
    fix: "Reset keeps seed products out",
    tests: [
      "stock-history: after Reset all data, seed products do not come back",
      "backup: reset stays empty after reloading every page",
      "backup: backup, reset, then restore gives back the same products",
    ],
    edits: [{
      file: "js/settings-data.js",
      from: "safeWrite(\"miniMartDeletedProducts\", window.miniMartDB.seedProductNames()),",
      to: "safeWrite(\"miniMartDeletedProducts\", []),",
    }],
  },
  {
    id: "restore-keeps-file-deleted-list",
    fix: "Restore brings back exactly the products in the file",
    tests: [
      "backup: restore brings back exactly the products in the file: an old file with no seed products",
      "backup: restore keeps a product the file lists as deleted, and keeps every seed the file has",
      "backup: a file with some seed products restores just those",
    ],
    edits: [{
      file: "js/settings-data.js",
      from: "    data.deletedProducts = window.miniMartDB.seedProductNames().filter((name) => !restoredNames.has(name));",
      to: "",
    }],
  },
  {
    id: "helper-defined-twice",
    fix: "One shared copy of each helper",
    tests: ["static: js: no helper is defined in two files"],
    edits: [{
      file: "js/reports.js",
      from: "function numericValue(value, fallback = 0) {",
      to: "function productLowStockThreshold() {}\nfunction numericValue(value, fallback = 0) {",
    }],
  },
  {
    id: "lexical-redeclaration",
    fix: "No page declares the same name twice",
    tests: ["static: reports: no fatal redeclarations", "pages: reports loads with no console errors or failed requests"],
    edits: [{
      file: "js/reports.js",
      from: "function numericValue(value, fallback = 0) {",
      to: "const productLowStockThreshold = 1;\nfunction numericValue(value, fallback = 0) {",
    }],
  },
  {
    id: "low-stock-threshold-changed",
    fix: "Low-stock results stay the same",
    tests: [
      "low-stock: Reports lists the same low-stock products with a store default of 10",
      "low-stock: Inventory lists the same low-stock products with a store default of 10",
    ],
    edits: [{ file: "js/utils.js", from: "Number.isFinite(configured) && configured > 0", to: "Number.isFinite(configured) && configured >= 0" }],
  },
  {
    id: "sale-drops-earned-points",
    fix: "A sale that redeems keeps its earned points",
    tests: ["suki-points: 30 points, redeem 10 on a P65 sale leaves 22, and the sale records both"],
    edits: [{ file: "js/suki-store.js", from: "pointsChange: earned - spent,", to: "pointsChange: -spent," }],
  },
  {
    id: "stored-balance-shown",
    fix: "Every screen shows the derived balance",
    tests: ["suki-points: the Suki list, detail, Checkout and card scan all show the same balance"],
    edits: [{ file: "js/suki-reward.js", from: "${peso(sukiRules.balance(suki))}", to: "${peso(suki.rewardBalance)}" }],
  },
  {
    id: "expired-points-revive",
    fix: "Expired points are written off before a change",
    tests: [
      "suki-points: expired points do not come back after a new purchase",
      "suki-points: the expiry entry is written at the next edit of that customer",
    ],
    edits: [{ file: "js/suki-store.js", from: "if (!(record.stamps > 0) || !rules.isExpired(rules.pointsEntryDate(record))) return record;", to: "return record;" }],
  },
  {
    id: "stale-save-changes-points",
    fix: "Only applyPointsChange changes points",
    tests: ["suki-points: only applyPointsChange can change points or history", "suki-points: two open tabs agree, and a stale tab cannot undo points"],
    edits: [{ file: "js/suki-store.js", from: "const kept = { ...record, stamps: current.stamps, history: current.history };", to: "const kept = { ...record };" }],
  },
  {
    id: "void-repeats",
    fix: "A void only reverses once",
    tests: ["suki-points: voiding the same sale twice does nothing the second time"],
    edits: [{ file: "js/suki-store.js", from: "records[index].history.some((entry) => entry.kind === \"void-reverse\" && entry.saleId === change.saleId)", to: "false" }],
  },
  {
    id: "void-no-shortfall-floor",
    fix: "A void floors at zero and records the shortfall",
    tests: ["suki-points: a void floors at zero and records the shortfall"],
    edits: [{ file: "js/suki-store.js", from: "shortfall: Math.max(0, -after),", to: "shortfall: 0," }],
  },
  {
    id: "void-outside-rollback",
    fix: "A failed void also restores points",
    tests: ["suki-points: a void that cannot write miniMartSales leaves sale, stock and points unchanged"],
    edits: [{ file: "js/reports.js", from: "\"miniMartInventoryAdjustments\", \"miniMartSukis\"]", to: "\"miniMartInventoryAdjustments\"]" }],
  },
  {
    id: "void-recalculates",
    fix: "A void uses the values on the sale",
    tests: ["suki-points: a void uses the values on the sale, not today's settings"],
    edits: [{ file: "js/reports.js", from: "{ sukiId: sale.sukiId, earned: sale.pointsEarned, spent: sale.pointsSpent }", to: "{ sukiId: sale.sukiId, earned: window.miniMartSukiRules.pointsEarned(sale.cashRequired), spent: window.miniMartSukiRules.pointsForPesos(sale.rewardUsed) }" }],
  },
  {
    id: "migration-no-backup",
    fix: "The migration backs up first and refuses without a backup",
    tests: [
      "suki-points: the migration backs up the raw list first, exactly",
      "suki-points: the migration refuses to run if the backup cannot be written",
    ],
    edits: [{
      file: "js/suki-store.js",
      from: "if (!safeWrite(`${POINTS_BACKUP_PREFIX}${Date.now()}`, stored.raw, { raw: true }).ok) {",
      to: "if (false) {",
    }],
  },
  {
    id: "migration-keeps-stamps-only",
    fix: "The migration keeps the higher value",
    tests: ["suki-points: the migration keeps the higher value and adds a correction entry only where needed"],
    edits: [{
      file: "js/suki-store.js",
      from: "const stamps = Math.max(rest.stamps, rules.pointsForPesos(rewardBalance));",
      to: "const stamps = rest.stamps;",
    }],
  },
  {
    id: "migration-switched-on",
    fix: "The migration stays off until approved",
    tests: ["suki-points: the migration is switched off and does not run on load"],
    edits: [{ file: "js/suki-store.js", from: "const SUKI_MIGRATION_ENABLED = false;", to: "const SUKI_MIGRATION_ENABLED = true;" }],
  },
  {
    id: "dialog-cancel-resets",
    fix: "Cancel changes nothing",
    tests: ["dialogs: Cancel leaves the section unchanged", "dialogs: Escape leaves the section unchanged", "dialogs: a backdrop click leaves the section unchanged"],
    edits: [{ file: "js/settings-core.js", from: "  if (!confirmed) return;\n  const defaults", to: "  const defaults" }],
  },
  {
    id: "dialog-no-focus-return",
    fix: "Focus returns to the opening button",
    tests: ["dialogs: focus returns to the button that opened it"],
    edits: [{ file: "js/utils.js", from: "    if (opener?.isConnected) opener.focus?.();\n", to: "" }],
  },
  {
    id: "dialog-no-escape",
    fix: "Escape means Cancel",
    tests: ["dialogs: Escape leaves the section unchanged"],
    edits: [{ file: "js/utils.js", from: "if (event.key === \"Escape\") {", to: "if (event.key === \"Never\") {" }],
  },
  {
    id: "dialog-scroll-stays-locked",
    fix: "The scroll lock is released",
    tests: ["dialogs: page scroll is locked while open and released after"],
    edits: [{ file: "js/utils.js", from: "    document.body.style.overflow = bodyOverflow;\n", to: "" }],
  },
  {
    id: "dialog-no-focus-trap",
    fix: "Tab stays inside the dialog",
    tests: ["dialogs: Tab and Shift+Tab stay inside the dialog"],
    edits: [{ file: "js/utils.js", from: "} else if (event.key === \"Tab\") {", to: "} else if (event.key === \"Never\") {" }],
  },
  {
    id: "dialog-stacks",
    fix: "Only one dialog at a time",
    tests: ["dialogs: a second dialog does not stack"],
    edits: [{ file: "js/utils.js", from: "  if (activeDialog) return Promise.resolve(false);\n", to: "" }],
  },
  {
    id: "dialog-focus-on-action",
    fix: "A danger dialog starts on the safe button",
    tests: ["dialogs: a danger dialog starts on the safe button"],
    edits: [{ file: "js/utils.js", from: "(danger && cancelButton ? cancelButton : confirmButton).focus();", to: "confirmButton.focus();" }],
  },
  {
    id: "dialog-error-leaves-page-stuck",
    fix: "An error never leaves the page stuck",
    tests: ["dialogs: an error while opening leaves the page usable"],
    edits: [{ file: "js/utils.js", from: "    console.error(\"The dialog could not be shown.\", error);\n    close(false);", to: "    console.error(\"The dialog could not be shown.\", error);" }],
  },
  {
    id: "native-confirm-returns",
    fix: "No browser confirm or alert remains",
    tests: ["static: js: no browser confirm or alert remains in app code"],
    edits: [{ file: "js/utils.js", from: "function categoryIconPath(category) {", to: "function askAgain() { return window.confirm('Sure?'); }\nfunction categoryIconPath(category) {" }],
  },
  {
    id: "native-alert-returns",
    fix: "No browser confirm or alert remains",
    tests: ["static: js: no browser confirm or alert remains in app code"],
    edits: [{ file: "js/reports.js", from: "const OLD_SALE_MATCH_MS = 60000;", to: "const OLD_SALE_MATCH_MS = 60000;\nfunction warn() { alert('Careful'); }" }],
  },
  {
    id: "held-cart-ignores-cancel",
    fix: "Cancel keeps the current cart",
    tests: ["dialogs: held cart: cancelling keeps the current cart and the held cart"],
    edits: [{ file: "js/checkout.js", from: "    tone: \"danger\",\n  }))) {\n    return;\n  }\n  const [next, ...remaining] = held;", to: "    tone: \"danger\",\n  }))) {\n  }\n  const [next, ...remaining] = held;" }],
  },
  {
    id: "similar-product-ignores-cancel",
    fix: "Go back adds nothing",
    tests: ["dialogs: similar product: going back adds nothing and keeps the form open"],
    edits: [{ file: "js/inventory.js", from: "    cancelLabel: \"Go back\",\n  }))) {\n    return;\n  }", to: "    cancelLabel: \"Go back\",\n  }))) {\n  }" }],
  },
  {
    id: "category-delete-ignores-cancel",
    fix: "Keep category keeps it",
    tests: ["dialogs: category delete: cancelling keeps the category"],
    edits: [{ file: "js/settings-categories.js", from: "      tone: \"danger\",\n    })) {\n      window.miniMartDB.deleteCategory(category);", to: "      tone: \"danger\",\n    }) || true) {\n      window.miniMartDB.deleteCategory(category);" }],
  },
  {
    id: "alert-before-reset-lost",
    fix: "An alert waits for an open dialog",
    tests: ["dialogs: an alert waits for an open dialog instead of being lost"],
    edits: [{ file: "js/utils.js", from: "  while (activeDialog) await activeDialog;\n", to: "  if (activeDialog) return;\n" }],
  },
  {
    id: "card-speed-limit-removed",
    fix: "Human typing is not a card",
    tests: [
      "card-reader: typing at 80 ms is never recognized, even with Enter at the end",
    ],
    edits: [{ file: "js/usb-reader.js", from: "const MAX_AVERAGE_GAP_MS = 50;", to: "const MAX_AVERAGE_GAP_MS = 500;" }],
  },
  {
    id: "card-duplicate-allowed",
    fix: "Two customers never share a card",
    tests: ["card-reader: a second customer cannot take the same card", "card-reader: a save cannot give two customers the same card"],
    edits: [
      { file: "js/suki-store.js", from: "if (owner && owner.id !== id) return refuse(", to: "if (false) return refuse(" },
      { file: "js/suki-store.js", from: "if (cardOwner) return refuse(", to: "if (false) return refuse(" },
    ],
  },
  {
    id: "card-field-not-repaired",
    fix: "Card digits never stay in a field",
    tests: [
      "card-reader: a card tapped in the Checkout search box leaves the box as it was",
      "card-reader: a card tapped in the amount box leaves it as it was",
      "card-reader: a card tapped in a customer name box leaves it as it was",
    ],
    edits: [{ file: "js/usb-reader.js", from: "    event.stopImmediatePropagation();\n    restoreField(snapshot);", to: "    event.stopImmediatePropagation();" }],
  },
  {
    id: "card-swallows-barcodes",
    fix: "Anything that is not a card stays a barcode",
    tests: [
      "card-reader: an all-digit barcode no customer owns still adds the product",
      "card-reader: a letters barcode no customer owns still adds the product",
    ],
    edits: [{ file: "js/usb-reader.js", from: "    if (!isCardMode() && !suki) return false;\n", to: "" }],
  },
  {
    id: "card-enter-submits",
    fix: "A card does not submit the form",
    tests: ["card-reader: a card tapped in a customer name box leaves it as it was"],
    edits: [{ file: "js/usb-reader.js", from: "    if (!recognized || !handleScan(code)) return;\n    event.preventDefault();\n    event.stopImmediatePropagation();", to: "    if (!recognized || !handleScan(code)) return;" }],
  },
  {
    id: "reader-says-ready-at-load",
    fix: "A page never claims the reader works before a read",
    tests: [
      "card-reader: a fresh Suki Rewards page claims nothing about the reader",
      "card-reader: a fresh Checkout page claims nothing about the reader",
      "card-reader: a fresh Settings page claims nothing about the reader",
    ],
    edits: [{ file: "js/usb-reader.js", from: "const WAITING_TITLE = \"Waiting for a card\";", to: "const WAITING_TITLE = \"USB card reader ready\";" }],
  },
  {
    id: "nfc-button-says-unsupported",
    fix: "The buttons arm card mode on a laptop",
    tests: ["card-reader: Checkout: Tap Suki's Card arms card mode for 30 seconds, with no NFC error"],
    edits: [{ file: "js/checkout.js", from: "    armUsbCheckout();\n    return;\n  }\n\n  const scanButton", to: "    document.getElementById(\"checkoutSukiScanStatus\").textContent = \"Web NFC is not supported in this browser.\";\n    return;\n  }\n\n  const scanButton" }],
  },
  {
    id: "scan-icon-says-unsupported",
    fix: "The buttons arm card mode on a laptop",
    tests: ["card-reader: Scan tab: the NFC icon arms card mode for 30 seconds, with no NFC error"],
    edits: [{ file: "js/suki-reward.js", from: "    armUsbScan();\n", to: "    scanTitle.textContent = \"NFC Not Supported\";\n" }],
  },
  {
    id: "human-typing-counts-as-read",
    fix: "Only a recognized card counts as a read",
    tests: ["card-reader: a barcode no customer owns never counts as a read"],
    edits: [{ file: "js/usb-reader.js", from: "    const suki = window.miniMartSukiStore?.findByCardCode?.(code) || null;\n", to: "    markRead();\n    const suki = window.miniMartSukiStore?.findByCardCode?.(code) || null;\n" }],
  },
  {
    id: "no-terminator-rule-dropped",
    fix: "A reader with no Enter or Tab still works",
    tests: [
      "card-reader: no terminator: a registered card is accepted and the field is put back",
      "card-reader: no terminator: an unknown card in card mode is accepted",
    ],
    edits: [{ file: "js/usb-reader.js", from: "      silenceTimer = window.setTimeout(endBurstOnSilence, SILENCE_END_MS);\n", to: "" }],
  },
  {
    id: "card-mode-condition-dropped",
    fix: "Without card mode or an owner, a code stays a barcode",
    tests: [
      "card-reader: no terminator: a code nobody owns stays in the search box, out of card mode",
      "card-reader: an all-digit barcode no customer owns still adds the product",
    ],
    edits: [{ file: "js/usb-reader.js", from: "    if (!isCardMode() && !suki) return false;\n", to: "" }],
  },
  {
    id: "no-terminator-human-accepted",
    fix: "Human typing is not a card, even with no terminator",
    tests: ["card-reader: no terminator: human typing of a registered code is not a card"],
    edits: [{ file: "js/usb-reader.js", from: "    if (!fast) return \"too slow\";\n", to: "" }],
  },
  {
    id: "card-sent-away",
    fix: "A card code never leaves the page",
    tests: ["card-reader: a registered card sends nothing and stores nothing on Suki Rewards"],
    edits: [{ file: "js/usb-reader.js", from: "    markRead();\n    if (onCard) onCard(code, suki);", to: "    markRead();\n    window.fetch(`/seen?code=${code}`);\n    if (onCard) onCard(code, suki);" }],
  },
  {
    id: "card-stored-by-reader",
    fix: "The reader stores nothing",
    tests: ["card-reader: a registered card sends nothing and stores nothing on Suki Rewards"],
    edits: [{ file: "js/usb-reader.js", from: "    markRead();\n    if (onCard) onCard(code, suki);", to: "    markRead();\n    localStorage.setItem(\"lastCard\", code);\n    if (onCard) onCard(code, suki);" }],
  },
  {
    id: "remove-card-ignores-cancel",
    fix: "Keep card keeps it",
    tests: ["card-reader: Remove card: Cancel changes nothing"],
    edits: [{ file: "js/suki-reward.js", from: "if (confirmed && sukiStore.clearCardCode(suki.id).ok) showSukiDetails(suki.id);", to: "if (sukiStore.clearCardCode(suki.id).ok) showSukiDetails(suki.id);" }],
  },
  {
    id: "no-note-on-other-pages",
    fix: "Other pages keep card digits out of their fields",
    tests: ["card-reader: Inventory: a registered card leaves the search box alone and shows a note"],
    edits: [{ file: "inventory.html", from: "    <script src=\"js/usb-reader.js\"></script>\n", to: "" }],
  },
  {
    id: "card-always-fires-change",
    fix: "An unchanged field fires no event",
    tests: ["card-reader: Reports: a registered card leaves a focused field alone and shows a note"],
    edits: [{ file: "js/usb-reader.js", from: "    if (changed) element.dispatchEvent(", to: "    element.dispatchEvent(" }],
  },
  {
    id: "card-no-fresh-read",
    fix: "A write checks the stored list, not an in-memory copy",
    tests: [
      "card-duplicates: a stale list cannot put a stored card on a second customer",
      "card-duplicates: two saves from one moment: the first wins and the second is refused",
    ],
    edits: [{ file: "js/suki-store.js", from: "const owner = [...storedRecords, ...records].find(", to: "const owner = [...records].find(" }],
  },
  {
    id: "stale-list-drops-card",
    fix: "A stale list cannot delete a card",
    tests: ["card-duplicates: a stale list cannot remove a card"],
    edits: [{ file: "js/suki-store.js", from: "const kept = { ...current, ...record, stamps: current.stamps, history: current.history };", to: "const kept = { ...record, stamps: current.stamps, history: current.history };" }],
  },
  {
    id: "old-duplicate-blocks-edits",
    fix: "An old duplicate does not block other edits",
    tests: ["card-duplicates: an old duplicate does not block edits to anyone"],
    edits: [{ file: "js/suki-store.js", from: "if (!record.cardCode || record.cardCode === stored.get(record.id)?.cardCode) continue;", to: "if (!record.cardCode) continue;" }],
  },
  {
    id: "ambiguous-card-guesses",
    fix: "An ambiguous card selects nobody",
    tests: [
      "card-duplicates: an ambiguous card at Checkout selects nobody, and a sale earns no points",
      "card-duplicates: an ambiguous card on the Scan tab shows nobody",
    ],
    edits: [{ file: "js/suki-store.js", from: "    return owners.length === 1 ? owners[0] : null;", to: "    return owners[0] || null;" }, { file: "js/suki-store.js", from: "    return cardOwners(code).length > 1;", to: "    return false;" }],
  },
  {
    id: "restore-hides-duplicate",
    fix: "A restore reports duplicates",
    tests: ["card-duplicates: a restore with a duplicate warns and enters the resolve flow"],
    edits: [{ file: "js/settings-data.js", from: "duplicateCardGroups(data.customers || []).map(", to: "[].map(" }],
  },
  {
    id: "no-duplicate-backup",
    fix: "The list is backed up before anything changes",
    tests: ["card-duplicates: a duplicate backs up the raw list once, and nothing changes"],
    edits: [{ file: "js/suki-store.js", from: "  if (!startupProblem && duplicateCards().length) saveOneTimeBackup(CARD_DUPLICATES_PREFIX, loadStored().raw);\n", to: "" }],
  },
  {
    id: "keep-card-ignores-cancel",
    fix: "Decide later changes nothing",
    tests: ["card-duplicates: Decide later changes nothing"],
    edits: [{ file: "js/suki-reward.js", from: "if (!confirmed || !sukiStore.keepCardFor(owner.id, code).ok) return;", to: "if (!sukiStore.keepCardFor(owner.id, code).ok) return;" }],
  },
  {
    id: "badge-ignores-card-code",
    fix: "Badges show USB cards",
    tests: [
      "card-duplicates: badge for USB only: All Sukis list",
      "card-duplicates: badge for USB only: customer detail",
      "card-duplicates: badge for USB only: Checkout customer panel",
    ],
    edits: [{ file: "js/utils.js", from: "  if (customer?.cardCode) labels.push(`USB card ····${cardEnding(customer.cardCode)}`);\n", to: "" }],
  },
  {
    id: "caret-stays-after-read",
    fix: "A read leaves no caret behind",
    tests: ["card-duplicates: after a read the status shows no caret and nothing typeable is focused"],
    edits: [{ file: "js/usb-reader.js", from: "    clearStrayCaret();\n", to: "" }],
  },
  {
    id: "caret-color-removed",
    fix: "Status text never shows a caret",
    tests: ["card-duplicates: after a read the status shows no caret and nothing typeable is focused"],
    edits: [{ file: "css/styles.css", from: "body {\n  caret-color: transparent;\n}\n", to: "" }],
  },
  {
    id: "overlay-no-delay",
    fix: "The overlay waits 300 ms",
    tests: ["overlay: a fast navigation never shows the overlay"],
    edits: [{
      file: "js/navigation.js",
      from: "loadingTimer = window.setTimeout(() => showLoading(\"Loading...\"), 300);",
      to: "showLoading(\"Loading...\");",
    }],
  },
  {
    id: "overlay-stuck-after-back",
    fix: "The overlay clears when a page is restored",
    tests: ["overlay: pressing Back after a slow navigation clears the overlay, from the back-forward cache"],
    edits: [{ file: "js/navigation.js", from: "if (event.persisted || pageReady) {", to: "if (false) {" }],
  },
  {
    id: "overlay-no-offline-message",
    fix: "Offline shows its own message",
    tests: ["overlay: offline, a slow action shows the offline message"],
    edits: [{ file: "js/navigation.js", from: "navigator.onLine === false", to: "false" }],
  },
];

// The reverse check for KNOWN BUGS: each entry fixes one bug in memory, and its tests
// must then pass. It proves those tests fail because of the bug, not by accident. These
// are test aids, not the final fixes.
const notCash = "(paymentMethod.value === \"card\" || paymentMethod.value === \"gcash\")";
const localDay = (date) => `new Date(${date}.getTime() - ${date}.getTimezoneOffset() * 60000).toISOString().slice(0, 10)`;
const trialFixes = [
  {
    id: "trial-shift-cash",
    tests: [
      "known-bugs: shift cash: a P65 cash sale paid with P100 adds P65 to the shift",
      "known-bugs: shift cash: the sale records P65 cash, not the P100 tendered",
      "known-bugs: shift cash: a card sale adds nothing to shift cash",
    ],
    edits: [
      { file: "js/checkout.js", from: "shift.cashSales += paid;", to: `shift.cashSales += ${notCash} ? 0 : paid - change;` },
      { file: "js/checkout.js", from: "        cash: paid,\n", to: `        cash: ${notCash} ? 0 : paid - change,\n` },
    ],
  },
  {
    id: "trial-close-shift-cancel",
    tests: ["known-bugs: close shift: Cancel leaves the shift open", "known-bugs: close shift: a blank amount leaves the shift open"],
    edits: [{
      file: "js/checkout.js",
      from: "const closingCash = Number(window.prompt(",
      to: "const closingCash = ((value) => (value === null || value.trim() === \"\" ? NaN : Number(value)))(window.prompt(",
    }],
  },
  {
    id: "trial-reports-local-day",
    tests: ["known-bugs: reports today: a 7 AM sale counts as today", "known-bugs: reports today: at 7:30 AM, yesterday's sale is not counted as today"],
    edits: [
      { file: "js/reports.js", from: "const todayKey = new Date().toISOString().slice(0, 10);", to: `const todayKey = ((now) => ${localDay("now")})(new Date());` },
      { file: "js/reports.js", from: "const saleKey = saleDate.toISOString().slice(0, 10);", to: `const saleKey = ${localDay("saleDate")};` },
    ],
  },
  {
    id: "trial-trends-all-sales",
    tests: ["known-bugs: trends: the comparison uses yesterday's real sales", "known-bugs: trends: the 7-day trend shows all 7 days with the Today filter on"],
    edits: [{ file: "js/reports.js", from: "const salesByDay = sales.reduce(", to: "const salesByDay = allSales.reduce(" }],
  },
  {
    id: "trial-void-all-items",
    tests: ["known-bugs: void: with a category filter on, every item's stock comes back"],
    edits: [{
      file: "js/reports.js",
      from: "  const inventory = window.miniMartDB.products();\n  itemsForReport(sale).forEach((item) => {",
      to: "  const inventory = window.miniMartDB.products();\n  (sale.items || []).forEach((item) => {",
    }],
  },
  {
    id: "trial-exports-skip-voided",
    tests: ["known-bugs: exports: voided sales are left out"],
    edits: [{
      file: "js/settings-export.js",
      from: "    const date = new Date(sale.date);\n    if (Number.isNaN(date.getTime())) return false;\n    const key = storeDateString(date);",
      to: "    if (sale.status === \"voided\") return false;\n    const date = new Date(sale.date);\n    if (Number.isNaN(date.getTime())) return false;\n    const key = storeDateString(date);",
    }],
  },
  {
    id: "trial-hold-clears-customer",
    tests: ["known-bugs: hold: holding a cart clears the Suki customer"],
    edits: [{
      file: "js/checkout.js",
      from: "  showCheckoutToast(\"Cart held. Use RESUME CART to restore it.\", \"success\");",
      to: "  selectedSukiId = \"\";\n  showCheckoutToast(\"Cart held. Use RESUME CART to restore it.\", \"success\");",
    }],
  },
  {
    id: "trial-login-check",
    tests: [
      "known-bugs-login: login check: settings sends a signed-out visitor to the login page",
      "known-bugs-login: login check: suki-reward sends a signed-out visitor to the login page",
    ],
    edits: [{
      file: "js/navigation.js",
      from: "const settingsApi = window.miniMartSettings;",
      to: "void (async () => { const client = window.supabaseClient; const reply = client ? await client.auth.getSession() : null; if (!reply?.data?.session) window.location.replace(\"login.html\"); })();\nconst settingsApi = window.miniMartSettings;",
    }],
  },
  {
    id: "trial-hidden-wins",
    tests: ["index", "reports", "settings"].map((page) => `known-bugs-login: hidden: nothing marked hidden is on screen on ${page}`),
    edits: [{ file: "css/styles.css", from: ":root {\n  --paper: #f5f4ee;", to: "[hidden] { display: none !important; }\n:root {\n  --paper: #f5f4ee;" }],
  },
];

module.exports = { mutations, trialFixes };
