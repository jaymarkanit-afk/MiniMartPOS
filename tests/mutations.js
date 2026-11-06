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
        from: "item.amountMode = measuredMode === \"amount\" || (!measuredEditName && Boolean(item.amountMode));\n  item.inputValue = String(item.amountMode ? item.lineTotal : item.quantity);",
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
      file: "js/settings.js",
      from: "return `${prefix}-${storeDateString()}.${extension}`;",
      to: "return `${prefix}-${new Date().toISOString().slice(0, 10)}.${extension}`;",
    }],
  },
  {
    id: "no-restore-rollback",
    fix: "A failed restore puts every key back",
    tests: ["backup: a restore that fails part way puts every key back"],
    edits: [{
      file: "js/settings.js",
      from: ".filter((entry) => !restoreRawValue(entry.key, entry.raw).ok)",
      to: ".filter(() => false)",
    }],
  },
  {
    id: "no-backup-before-reset",
    fix: "Reset backs up first",
    tests: ["backup: reset downloads a backup first, then erases", "backup: reset stops and erases nothing if the automatic backup fails"],
    edits: [{
      file: "js/settings.js",
      from: "createBackupFile(\"mini-mart-pos-pre-reset-backup\", { requireComplete: true });",
      to: "",
    }],
  },
  {
    id: "no-backup-shape-check",
    fix: "Broken backup files are rejected",
    tests: ["backup: broken backup files are rejected and nothing is written"],
    edits: [{
      file: "js/settings.js",
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
    edits: [{ file: "js/database.js", from: "const DATA_VERSION = 2;", to: "const DATA_VERSION = 1;" }],
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
      file: "js/settings.js",
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
      file: "js/settings.js",
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
      file: "js/settings.js",
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
