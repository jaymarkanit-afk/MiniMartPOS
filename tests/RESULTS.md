# Test results

From `node tests/run.js` and `node tests/mutate.js` on 2026-11-06. Two full runs gave identical results.

188 tests, 178 passed, 10 failed.

| Suite | Passed | Failed |
|---|---|---|
| backup | 15 | 0 |
| corruption | 25 | 0 |
| suki-store | 17 | 0 |
| stock-history | 23 | 1 |
| checkout | 9 | 0 |
| measured-draft | 16 | 0 |
| cart-draft | 13 | 1 |
| expiry | 6 | 0 |
| static | 17 | 0 |
| pages | 6 | 0 |
| icons | 20 | 7 |
| overlay | 11 | 0 |
| requests | 0 | 1 |

## All tests

| Test | Result | Reason |
|---|---|---|
| backup: clicking Backup downloads a complete file and records the date | PASS |  |
| backup: backup filename uses the store timezone, not the computer's | PASS |  |
| backup: restore into an empty app shows a preview, backs up first, restores every section | PASS |  |
| backup: restoring a backup with no open shift clears the open shift | PASS |  |
| backup: restore keeps existing stock history and appends restore entries | PASS |  |
| backup: an old version 1 backup restores and leaves sections it lacks unchanged | PASS |  |
| backup: broken backup files are rejected and nothing is written | PASS |  |
| backup: a restore that fails part way puts every key back | PASS |  |
| backup: reset downloads a backup first, then erases | PASS |  |
| backup: reset stops and erases nothing if the automatic backup fails | PASS |  |
| backup: reset stops if a section cannot be read | PASS |  |
| backup: restore stops and changes nothing if the automatic backup fails | PASS |  |
| backup: a failed backup keeps the last date, and a partial backup says what it left out | PASS |  |
| backup: sales, product and customer exports work in Excel and PDF | PASS |  |
| backup: the page reloads cleanly after a restore | PASS |  |
| corruption: five normal sales create no corruption backups and no banner | PASS |  |
| corruption: false corruption backups are removed on load | PASS |  |
| corruption: broken product data on index is backed up, kept, and shown | PASS |  |
| corruption: broken product data on inventory is backed up, kept, and shown | PASS |  |
| corruption: broken product data on reports is backed up, kept, and shown | PASS |  |
| corruption: broken product data on settings is backed up, kept, and shown | PASS |  |
| corruption: broken product data on the Suki page is left untouched | PASS |  |
| corruption: reloading with broken data keeps one backup | PASS |  |
| corruption: data with the wrong shape is treated as corrupt | PASS |  |
| corruption: real corruption backups survive cleanup | PASS |  |
| corruption: the only good copy is kept while the live value is damaged | PASS |  |
| corruption: a dismissed banner stays gone | PASS |  |
| corruption: old backups alone do not show the banner | PASS |  |
| corruption: a failed corruption backup still lets the sale save | PASS |  |
| corruption: a failed write to miniMartSales rolls the whole sale back | PASS |  |
| corruption: a failed write to miniMartProducts rolls the whole sale back | PASS |  |
| corruption: a failed write to miniMartSukis rolls the whole sale back | PASS |  |
| corruption: a failed write to miniMartCurrentShift rolls the whole sale back | PASS |  |
| corruption: a nearly full store still saves the sale and cleans up after itself | PASS |  |
| corruption: a large corrupt value keeps only the newest backup | PASS |  |
| corruption: the same corruption is backed up once and a change is backed up again | PASS |  |
| corruption: sales keep saving with 1500 sales stored | PASS |  |
| corruption: sales keep saving with 3000 sales stored | PASS |  |
| corruption: sales keep saving with 5000 sales stored | PASS |  |
| corruption: the backup file never includes corruption backups | PASS |  |
| suki-store: customers with no id are listed, and adding one keeps them all | PASS |  |
| suki-store: every tab derives the same id, whatever the load order or list order | PASS |  |
| suki-store: customers with the same name stay separate | PASS |  |
| suki-store: the original list is backed up once, exactly | PASS |  |
| suki-store: a list that needs no migration is left byte-identical | PASS |  |
| suki-store: over-limit values are stored exactly, and a sale to someone else leaves them alone | PASS |  |
| suki-store: a sale goes to the customer who was selected | PASS |  |
| suki-store: deleting a customer removes only that customer | PASS |  |
| suki-store: saves that would lose customers are refused | PASS |  |
| suki-store: a stale tab cannot drop a customer added elsewhere | PASS |  |
| suki-store: an unreadable customer list is never overwritten: {bad | PASS |  |
| suki-store: an unreadable customer list is never overwritten: {"wrong":true} | PASS |  |
| suki-store: records with no usable content are set aside, not lost | PASS |  |
| suki-store: if the backup fails, nothing migrates and customers stay visible | PASS |  |
| suki-store: duplicate and numeric ids are repaired | PASS |  |
| suki-store: old records that arrive later, for example from another tab, are migrated on save | PASS |  |
| suki-store: card ids are normalized and can be looked up | PASS |  |
| stock-history: the product form logs a stock change | PASS |  |
| stock-history: editing only the price logs nothing | PASS |  |
| stock-history: renaming a product keeps its history together | PASS |  |
| stock-history: adding a product logs its opening stock | PASS |  |
| stock-history: bulk edit logs each changed product | PASS |  |
| stock-history: a manual adjustment and its undo are both logged | PASS |  |
| stock-history: deleting a product logs its stock going to zero | PASS |  |
| stock-history: an import logs only the stock it changed, with the file name | PASS |  |
| stock-history: a sale and its void are both logged against the sale id | PASS |  |
| stock-history: a measured sale logs exact decimals | PASS |  |
| stock-history: if history cannot be written, the stock change does not happen | PASS |  |
| stock-history: if stock cannot be written, the history entry is rolled back | PASS |  |
| stock-history: a sale that cannot save leaves stock and history alone | PASS |  |
| stock-history: a void that cannot save leaves stock and history alone | PASS |  |
| stock-history: an import that fails part way changes nothing | PASS |  |
| stock-history: the viewer shows old and new entries, newest first, with no injected HTML | PASS |  |
| stock-history: the history export has the right columns and values | PASS |  |
| stock-history: history stops at 1,000 entries and warns until it is exported | PASS |  |
| stock-history: a restore logs what it changed | PASS |  |
| stock-history: restoring a file with no history keeps the current history | PASS |  |
| stock-history: a first visit logs seed stock once | PASS |  |
| stock-history: after Reset all data, seed products do not come back | **FAIL** | products after reset: expected 0, got 17 |
| stock-history: reading the app writes no products or history | PASS |  |
| stock-history: damaged history does not stop a sale, and is kept | PASS |  |
| checkout: a restored cart stays correct after adding, removing and selling | PASS |  |
| checkout: a held cart with a stale line total is priced from its quantity | PASS |  |
| checkout: a measured item sold by amount keeps the exact amount | PASS |  |
| checkout: a measured item sold by quantity is priced from its quantity | PASS |  |
| checkout: a reward above the bill is clamped the same on screen and in the sale | PASS |  |
| checkout: a stored balance below the points is the most that can be spent | PASS |  |
| checkout: with no customer, a reward value in the box is ignored | PASS |  |
| checkout: below the redeem minimum, no reward applies | PASS |  |
| checkout: split payment shows the right cash and change | PASS |  |
| measured-draft: two amounts survive a reload | PASS |  |
| measured-draft: uneven amounts keep their exact values | PASS |  |
| measured-draft: a single uneven amount keeps its exact value | PASS |  |
| measured-draft: quantity then amount survive a reload | PASS |  |
| measured-draft: amount then quantity survive a reload | PASS |  |
| measured-draft: a second reload changes nothing | PASS |  |
| measured-draft: editing a combined line shows the full amount | PASS |  |
| measured-draft: after a price change, the customer keeps the amount they asked for | PASS |  |
| measured-draft: after a stock drop, the line is clamped to what is left | PASS |  |
| measured-draft: a sale after a restore records the full amount | PASS |  |
| measured-draft: an older draft with no saved total still loads | PASS |  |
| measured-draft: an older draft with a mismatched quantity stays consistent | PASS |  |
| measured-draft: uneven amount plus quantity keeps the exact value | PASS |  |
| measured-draft: editing a combined line replaces it | PASS |  |
| measured-draft: quantity lines behave as before | PASS |  |
| measured-draft: fixed-price lines behave as before | PASS |  |
| cart-draft: the cart saves itself without any explicit save | PASS |  |
| cart-draft: a reload restores the cart, customer, payment method and amounts | PASS |  |
| cart-draft: a draft with broken JSON leaves an empty cart and working checkout | PASS |  |
| cart-draft: a draft with the wrong shape leaves an empty cart and working checkout | PASS |  |
| cart-draft: a draft with an unknown version leaves an empty cart and working checkout | PASS |  |
| cart-draft: a draft older than 24 hours is discarded | PASS |  |
| cart-draft: a draft just under 24 hours old is restored | PASS |  |
| cart-draft: a changed price uses today's price and tells the cashier | PASS |  |
| cart-draft: lower stock clamps the quantity and tells the cashier | PASS |  |
| cart-draft: a sold-out item is removed and counted once | **FAIL** | toast: 2 items were adjusted because stock or prices changed. |
| cart-draft: a deleted product is removed from the restored cart | PASS |  |
| cart-draft: a finished sale clears the draft and it stays cleared | PASS |  |
| cart-draft: holding a cart clears the draft | PASS |  |
| cart-draft: if the draft cannot be saved, the cashier is told and the cart stays | PASS |  |
| expiry: with expiry on, only customers with real old dates lose points | PASS |  |
| expiry: the rule treats missing dates as not expired | PASS |  |
| expiry: the preview script and the rules name the same customers | PASS |  |
| expiry: reading customers and running the preview changes no data | PASS |  |
| expiry: a customer with no dates keeps their points at Checkout | PASS |  |
| expiry: with expiry off, everyone keeps their points | PASS |  |
| static: index: no undefined functions | PASS |  |
| static: index: no fatal redeclarations | PASS |  |
| static: inventory: no undefined functions | PASS |  |
| static: inventory: no fatal redeclarations | PASS |  |
| static: reports: no undefined functions | PASS |  |
| static: reports: no fatal redeclarations | PASS |  |
| static: settings: no undefined functions | PASS |  |
| static: settings: no fatal redeclarations | PASS |  |
| static: suki-reward: no undefined functions | PASS |  |
| static: suki-reward: no fatal redeclarations | PASS |  |
| static: login: no undefined functions | PASS |  |
| static: login: no fatal redeclarations | PASS |  |
| static: index: every required element exists | PASS |  |
| static: inventory: every required element exists | PASS |  |
| static: reports: every required element exists | PASS |  |
| static: settings: every required element exists | PASS |  |
| static: suki-reward: every required element exists | PASS |  |
| pages: index loads with no console errors or failed requests | PASS |  |
| pages: inventory loads with no console errors or failed requests | PASS |  |
| pages: reports loads with no console errors or failed requests | PASS |  |
| pages: settings loads with no console errors or failed requests | PASS |  |
| pages: suki-reward loads with no console errors or failed requests | PASS |  |
| pages: login loads with no console errors or failed requests | PASS |  |
| icons: every allowed icon exists on disk, and the list has exactly 14 | PASS |  |
| icons: Inventory picker shows exactly the 14 icons, with no cart and none broken | PASS |  |
| icons: Inventory tooltip shows the right label on hover | PASS |  |
| icons: Inventory tooltip shows the right label on keyboard focus | PASS |  |
| icons: Settings picker shows exactly the 14 icons, with no cart and none broken | PASS |  |
| icons: Settings tooltip shows the right label on hover | **FAIL** | hover 0: expected {"count":1,"text":"Amenities","onScreen":true}, got {"count":0} |
| icons: Settings tooltip shows the right label on keyboard focus | PASS |  |
| icons: old icon ids and paths move to the right PNG and stay there after two reloads | PASS |  |
| icons: current icon ids and their paths are stable | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "<img src=x onerror=\"window.__pwned=1\">" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "\"><script>window.__pwned=1</script>" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "javascript:window.__pwned=1" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "../../secret.png" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "Icons/evil.svg" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "constructor" | **FAIL** | state: expected {"stored":"bread","id":"bread","pwned":null,"scripts":0,"broken":[]}, got {"id":"bread","pwned":null,"scripts":0,"broken":[]} |
| icons: a tampered icon value falls back and injects nothing: "__proto__" | **FAIL** | state: expected {"stored":"bread","id":"bread","pwned":null,"scripts":0,"broken":[]}, got {"stored":{},"id":"bread","pwned":null,"scripts":0,"broken":[]} |
| icons: a tampered icon value falls back and injects nothing: "toString" | **FAIL** | state: expected {"stored":"bread","id":"bread","pwned":null,"scripts":0,"broken":[]}, got {"id":"bread","pwned":null,"scripts":0,"broken":[]} |
| icons: a tampered icon value falls back and injects nothing: 42 | PASS |  |
| icons: a tampered icon value falls back and injects nothing: null | PASS |  |
| icons: a tampered icon value falls back and injects nothing: {"path":"Icons/evil.svg"} | PASS |  |
| icons: Inventory shows category icons with no broken images | PASS |  |
| icons: Settings shows category icons with no broken images | PASS |  |
| icons: Checkout shows category icons with no broken images | PASS |  |
| icons: Manage categories: every Edit category opens with a mouse click at 1366x650 | **FAIL** | rows out of 4 that a click could not open: expected [], got [1,2,3] |
| icons: Manage categories: every Edit category opens with a mouse click at 1264x805 | **FAIL** | rows out of 4 that a click could not open: expected [], got [1,2,3] |
| icons: Manage categories: every Edit category opens with a mouse click at 1920x1040 | PASS |  |
| icons: Manage categories: the empty message is hidden while categories are listed | **FAIL** | display: expected "none", got "grid" |
| overlay: a fast navigation never shows the overlay | PASS |  |
| overlay: a slow navigation shows the overlay after about 300 ms, then clears it | PASS |  |
| overlay: pressing Back after a slow navigation clears the overlay, from the back-forward cache | PASS |  |
| overlay: pressing Back after a fast navigation leaves no overlay | PASS |  |
| overlay: pressing Back on a page that is reloaded leaves no overlay | PASS |  |
| overlay: after about 8 seconds a slow navigation shows the slow message with Retry and Dismiss | PASS |  |
| overlay: Dismiss closes the slow message | PASS |  |
| overlay: Retry reloads the page and clears the overlay | PASS |  |
| overlay: offline, a slow action shows the offline message | PASS |  |
| overlay: a finished action hides the overlay | PASS |  |
| overlay: a failed action shows an error, then clears | PASS |  |
| requests: no app request failed at any point in the run | **FAIL** | Failed requests: 404 /favicon.ico |

## Mutation check

Each mutation reverts one fix in memory. Every listed test must fail while it is applied.

| Mutation | Fix it reverts | Test | Result |
|---|---|---|---|
| `stale-line-total` | A fixed-price line is priced from its quantity (4ade2e6) | checkout: a held cart with a stale line total is priced from its quantity | CAUGHT |
| `reward-ignores-balance` | One reward amount for screen and sale (a165fe2) | checkout: a stored balance below the points is the most that can be spent | CAUGHT |
| `draft-drops-line-total` | Measured drafts save the running total (f9ecd73) | measured-draft: uneven amounts keep their exact values | CAUGHT |
| `measured-keeps-last-amount` | Measured lines keep the running total, not the last entry (f9ecd73, fully reverted) | measured-draft: two amounts survive a reload | CAUGHT |
| `measured-keeps-last-amount` | Measured lines keep the running total, not the last entry (f9ecd73, fully reverted) | measured-draft: editing a combined line shows the full amount | CAUGHT |
| `draft-kept-after-sale` | A finished sale clears the draft | cart-draft: a finished sale clears the draft and it stays cleared | CAUGHT |
| `no-premigration-backup` | Suki migration backs up the original list first | suki-store: the original list is backed up once, exactly | CAUGHT |
| `no-shrink-guard` | Saves that lose customers are refused | suki-store: saves that would lose customers are refused | CAUGHT |
| `no-shrink-guard` | Saves that lose customers are refused | suki-store: a stale tab cannot drop a customer added elsewhere | CAUGHT |
| `backup-filename-utc` | Backup filename uses the store timezone | backup: backup filename uses the store timezone, not the computer's | CAUGHT |
| `no-restore-rollback` | A failed restore puts every key back | backup: a restore that fails part way puts every key back | CAUGHT |
| `no-backup-before-reset` | Reset backs up first | backup: reset downloads a backup first, then erases | CAUGHT |
| `no-backup-before-reset` | Reset backs up first | backup: reset stops and erases nothing if the automatic backup fails | CAUGHT |
| `no-backup-shape-check` | Broken backup files are rejected | backup: broken backup files are rejected and nothing is written | CAUGHT |
| `no-false-corruption-cleanup` | False corruption backups are removed on load | corruption: false corruption backups are removed on load | CAUGHT |
| `no-corruption-dedupe` | The same corruption is backed up once | corruption: the same corruption is backed up once and a change is backed up again | CAUGHT |
| `stock-write-no-undo` | Stock and history are written atomically | stock-history: if stock cannot be written, the history entry is rolled back | CAUGHT |
| `products-always-write` | products() is read-only unless normalization changed data | stock-history: reading the app writes no products or history | CAUGHT |
| `missing-date-expires` | Missing dates never remove points (1d74e6e) | expiry: with expiry on, only customers with real old dates lose points | CAUGHT |
| `missing-date-expires` | Missing dates never remove points (1d74e6e) | expiry: the rule treats missing dates as not expired | CAUGHT |
| `cart-icon-in-picker` | The cart icon is not in the picker | icons: Inventory picker shows exactly the 14 icons, with no cart and none broken | CAUGHT |
| `no-legacy-cart-alias` | Old cart ids move to the right PNG | icons: old icon ids and paths move to the right PNG and stay there after two reloads | CAUGHT |
| `tooltip-no-focus` | The tooltip works from the keyboard | icons: Inventory tooltip shows the right label on keyboard focus | CAUGHT |
| `tooltip-no-focus` | The tooltip works from the keyboard | icons: Settings tooltip shows the right label on keyboard focus | CAUGHT |
| `overlay-no-delay` | The overlay waits 300 ms | overlay: a fast navigation never shows the overlay | CAUGHT |
| `overlay-stuck-after-back` | The overlay clears when a page is restored | overlay: pressing Back after a slow navigation clears the overlay, from the back-forward cache | CAUGHT |
| `overlay-no-offline-message` | Offline shows its own message | overlay: offline, a slow action shows the offline message | CAUGHT |
