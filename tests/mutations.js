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
    id: "reward-ignores-balance",
    fix: "One reward amount for screen and sale (a165fe2)",
    tests: ["checkout: a stored balance below the points is the most that can be spent"],
    edits: [{
      file: "js/checkout.js",
      from: "Math.min(requested, suki.rewardBalance, sukiRules.maxRedeemAmount(points, total))",
      to: "Math.min(requested, sukiRules.maxRedeemAmount(points, total))",
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

module.exports = { mutations };
