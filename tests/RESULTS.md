# Test results

From `node tests/run.js` on 2026-11-06.

480 tests, 480 passed, 0 failed. Known bugs: 17 tests, 17 still fail.

| Suite | Passed | Failed |
|---|---|---|
| backup | 23 | 0 |
| corruption | 25 | 0 |
| suki-store | 17 | 0 |
| stock-history | 24 | 0 |
| checkout | 10 | 0 |
| measured-draft | 16 | 0 |
| cart-draft | 14 | 0 |
| expiry | 6 | 0 |
| low-stock | 5 | 0 |
| suki-points | 42 | 0 |
| product-ids | 23 | 0 |
| settings-page | 11 | 0 |
| static | 21 | 0 |
| pages | 12 | 0 |
| icons | 35 | 0 |
| dialogs | 46 | 0 |
| card-reader | 95 | 0 |
| card-duplicates | 43 | 0 |
| overlay | 11 | 0 |
| requests | 1 | 0 |

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
| backup: restore brings back exactly the products in the file: an old file with no seed products | PASS |  |
| backup: restore keeps a product the file lists as deleted, and keeps every seed the file has | PASS |  |
| backup: a file with some seed products restores just those | PASS |  |
| backup: backup, reset, then restore gives back the same products | PASS |  |
| backup: the preview does not claim the deleted list stays unchanged | PASS |  |
| backup: reset stays empty after reloading every page | PASS |  |
| backup: a product added after reset is kept, even with a sample product's name | PASS |  |
| backup: a fresh first visit shows the 17 sample products once | PASS |  |
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
| stock-history: after Reset all data, seed products do not come back | PASS |  |
| stock-history: reading the app writes no products or history | PASS |  |
| stock-history: damaged history does not stop a sale, and is kept | PASS |  |
| checkout: a restored cart stays correct after adding, removing and selling | PASS |  |
| checkout: a held cart with a stale line total is priced from its quantity | PASS |  |
| checkout: a measured item sold by amount keeps the exact amount | PASS |  |
| checkout: a measured item sold by quantity is priced from its quantity | PASS |  |
| checkout: a reward above the bill is clamped the same on screen and in the sale | PASS |  |
| checkout: what can be spent comes from the points, whatever the old balance says | PASS |  |
| checkout: no more than the points are worth can be spent | PASS |  |
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
| cart-draft: a sold-out item is removed and counted once | PASS |  |
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
| low-stock: Reports lists the same low-stock products with a store default of 10 | PASS |  |
| low-stock: Inventory lists the same low-stock products with a store default of 10 | PASS |  |
| low-stock: Reports lists the same low-stock products with a store default of 3 | PASS |  |
| low-stock: Inventory lists the same low-stock products with a store default of 3 | PASS |  |
| low-stock: with no settings saved, the store default is 10 | PASS |  |
| suki-points: 30 points, redeem 10 on a P65 sale leaves 22, and the sale records both | PASS |  |
| suki-points: history adds up through earn, redeem, void and expire | PASS |  |
| suki-points: the Suki list, detail, Checkout and card scan all show the same balance | PASS |  |
| suki-points: the ready-to-redeem filter and count use the derived balance | PASS |  |
| suki-points: the amount that can be spent never exceeds what is shown | PASS |  |
| suki-points: earning stops at 40 | PASS |  |
| suki-points: a customer with 55 points over the cap keeps them | PASS |  |
| suki-points: changing the peso value revalues the balance everywhere | PASS |  |
| suki-points: with expiry off, old points stay spendable | PASS |  |
| suki-points: with expiry on, expired points show as zero and stored data is untouched | PASS |  |
| suki-points: an expired customer shows 0 points on every screen | PASS |  |
| suki-points: a customer with no dates keeps their points through a sale, with expiry on | PASS |  |
| suki-points: expired points do not come back after a new purchase | PASS |  |
| suki-points: the expiry entry is written at the next edit of that customer | PASS |  |
| suki-points: a plain read writes nothing to storage | PASS |  |
| suki-points: only applyPointsChange can change points or history | PASS |  |
| suki-points: a void returns spent points and removes earned points | PASS |  |
| suki-points: a void uses the values on the sale, not today's settings | PASS |  |
| suki-points: voiding the same sale twice does nothing the second time | PASS |  |
| suki-points: a void floors at zero and records the shortfall | PASS |  |
| suki-points: a void on an old sale uses its matching history entry | PASS |  |
| suki-points: a void on an old sale that cannot be matched leaves points alone and says so | PASS |  |
| suki-points: a void matching two customers leaves points alone and says so | PASS |  |
| suki-points: a void that cannot write miniMartSales leaves sale, stock and points unchanged | PASS |  |
| suki-points: a void that cannot write miniMartProducts leaves sale, stock and points unchanged | PASS |  |
| suki-points: a void that cannot write miniMartSukis leaves sale, stock and points unchanged | PASS |  |
| suki-points: a sale that cannot write customers changes nothing | PASS |  |
| suki-points: a points change that cannot save returns a failure and changes nothing | PASS |  |
| suki-points: an edit that cannot save leaves points, history and the expiry entry unwritten | PASS |  |
| suki-points: a sale that cannot write sales changes no points | PASS |  |
| suki-points: a sale that cannot write stock changes no points | PASS |  |
| suki-points: the migration is switched off and does not run on load | PASS |  |
| suki-points: before the migration, the old balance moves with each points change | PASS |  |
| suki-points: the migration keeps the higher value and adds a correction entry only where needed | PASS |  |
| suki-points: the migration converts the balance using the peso value | PASS |  |
| suki-points: the migration backs up the raw list first, exactly | PASS |  |
| suki-points: the migration refuses to run if the backup cannot be written | PASS |  |
| suki-points: the migration leaves everything alone if its own write fails | PASS |  |
| suki-points: a second migration run changes nothing | PASS |  |
| suki-points: new customers and migrated customers have no stored balance | PASS |  |
| suki-points: an old backup containing rewardBalance restores and shows the derived balance | PASS |  |
| suki-points: two open tabs agree, and a stale tab cannot undo points | PASS |  |
| product-ids: every product gets a uuid, and an id that is already good stays | PASS |  |
| product-ids: migration leaves stock, totals, favourites and held carts the same | PASS |  |
| product-ids: references get the new id, and unmatched sale items are left alone | PASS |  |
| product-ids: the raw originals are backed up first, and only once | PASS |  |
| product-ids: if the backup fails, nothing migrates | PASS |  |
| product-ids: if a migration write fails, every key goes back | PASS |  |
| product-ids: reloading twice does not run the migration again or change ids | PASS |  |
| product-ids: a first visit gives sample products uuids that stay the same | PASS |  |
| product-ids: a new product gets a uuid | PASS |  |
| product-ids: an id is never reused after a delete | PASS |  |
| product-ids: a sale records the product id, and a void after a rename returns stock to it | PASS |  |
| product-ids: after a rename, history, favourite, held cart and reports follow the product | PASS |  |
| product-ids: a report filtered to a renamed product still finds its old sales | PASS |  |
| product-ids: an unmatched sale item is still grouped by its name in reports | PASS |  |
| product-ids: a draft follows a rename | PASS |  |
| product-ids: two products with the same name stay separate | PASS |  |
| product-ids: bulk edit selects a product by id, so twins are not mixed up | PASS |  |
| product-ids: an old import with no ids matches by name, warns, and adds no duplicates | PASS |  |
| product-ids: an import matches by barcode first, even when the name changed | PASS |  |
| product-ids: an import matches by id before name | PASS |  |
| product-ids: an imported new product gets a uuid | PASS |  |
| product-ids: restoring an old backup with no ids runs the migration | PASS |  |
| product-ids: a backup includes product ids | PASS |  |
| settings-page: every Settings tab opens its own panel | PASS |  |
| settings-page: saving store info keeps it | PASS |  |
| settings-page: saving inventory rules keeps them | PASS |  |
| settings-page: saving Suki rules keeps them | PASS |  |
| settings-page: the theme switches to dark and stays | PASS |  |
| settings-page: a category can be renamed | PASS |  |
| settings-page: a category with products can be deleted, moving them first | PASS |  |
| settings-page: the data health check runs | PASS |  |
| settings-page: the NFC status shows on this device | PASS |  |
| settings-page: settings scripts load after the libraries they use | PASS |  |
| settings-page: exported Excel and PDF data match the snapshot from before the split | PASS |  |
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
| static: js: no helper is defined in two files | PASS |  |
| static: js: every allowed duplicate still exists and really differs | PASS |  |
| static: js: lowStockThreshold is only the Settings input | PASS |  |
| static: js: no browser confirm or alert remains in app code | PASS |  |
| pages: index loads with no console errors or failed requests | PASS |  |
| pages: inventory loads with no console errors or failed requests | PASS |  |
| pages: reports loads with no console errors or failed requests | PASS |  |
| pages: settings loads with no console errors or failed requests | PASS |  |
| pages: suki-reward loads with no console errors or failed requests | PASS |  |
| pages: login loads with no console errors or failed requests | PASS |  |
| pages: index declares an icon that loads | PASS |  |
| pages: inventory declares an icon that loads | PASS |  |
| pages: reports declares an icon that loads | PASS |  |
| pages: settings declares an icon that loads | PASS |  |
| pages: suki-reward declares an icon that loads | PASS |  |
| pages: login declares an icon that loads | PASS |  |
| icons: every allowed icon exists on disk, and the list has exactly 14 | PASS |  |
| icons: Inventory picker shows exactly the 14 icons, with no cart and none broken | PASS |  |
| icons: Inventory tooltip shows the right label on hover | PASS |  |
| icons: Inventory tooltip shows the right label on keyboard focus | PASS |  |
| icons: Settings picker shows exactly the 14 icons, with no cart and none broken | PASS |  |
| icons: Settings tooltip shows the right label on hover | PASS |  |
| icons: Settings tooltip shows the right label on keyboard focus | PASS |  |
| icons: old icon ids and paths move to the right PNG and stay there after two reloads | PASS |  |
| icons: current icon ids and their paths are stable | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "<img src=x onerror=\"window.__pwned=1\">" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "\"><script>window.__pwned=1</script>" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "javascript:window.__pwned=1" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "../../secret.png" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "Icons/evil.svg" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "constructor" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "__proto__" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "toString" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "valueOf" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: "hasOwnProperty" | PASS |  |
| icons: a tampered icon value falls back and injects nothing: 42 | PASS |  |
| icons: a tampered icon value falls back and injects nothing: null | PASS |  |
| icons: a tampered icon value falls back and injects nothing: {"path":"Icons/evil.svg"} | PASS |  |
| icons: a tampered icon in a store that already ran the old migration is cleaned too | PASS |  |
| icons: Inventory shows category icons with no broken images | PASS |  |
| icons: Settings shows category icons with no broken images | PASS |  |
| icons: Checkout shows category icons with no broken images | PASS |  |
| icons: Manage categories: every Edit category opens with a mouse click at 1366x650 | PASS |  |
| icons: Manage categories: every Edit category opens with a mouse click at 1264x805 | PASS |  |
| icons: Manage categories: every Edit category opens with a mouse click at 1920x1040 | PASS |  |
| icons: Manage categories: all 16 rows are reachable by mouse at 1366x650 | PASS |  |
| icons: Manage categories: all 16 rows are reachable by mouse at 1264x805 | PASS |  |
| icons: Manage categories: all 16 rows are reachable by mouse at 1920x1040 | PASS |  |
| icons: Manage categories: a mouse click on an icon saves it | PASS |  |
| icons: Manage categories: the empty message is hidden while categories are listed | PASS |  |
| icons: Manage categories: the empty message shows when a search finds nothing | PASS |  |
| dialogs: the store reset shows the right title and message | PASS |  |
| dialogs: the action button resets the store section | PASS |  |
| dialogs: the inventory reset shows the right title and message | PASS |  |
| dialogs: the action button resets the inventory section | PASS |  |
| dialogs: the suki reset shows the right title and message | PASS |  |
| dialogs: the action button resets the suki section | PASS |  |
| dialogs: the reset changes only that section | PASS |  |
| dialogs: Cancel leaves the section unchanged | PASS |  |
| dialogs: Escape leaves the section unchanged | PASS |  |
| dialogs: a backdrop click leaves the section unchanged | PASS |  |
| dialogs: a click on the card itself does not close it | PASS |  |
| dialogs: Enter activates only the focused button | PASS |  |
| dialogs: a danger dialog starts on the safe button | PASS |  |
| dialogs: a normal dialog starts on the action button | PASS |  |
| dialogs: Tab and Shift+Tab stay inside the dialog | PASS |  |
| dialogs: focus returns to the button that opened it | PASS |  |
| dialogs: page scroll is locked while open and released after | PASS |  |
| dialogs: a second dialog does not stack | PASS |  |
| dialogs: an error while opening leaves the page usable | PASS |  |
| dialogs: the message is shown as text, so nothing can be injected | PASS |  |
| dialogs: the dialog fits and is clickable at 1366x650 | PASS |  |
| dialogs: the dialog fits and is clickable at 1264x805 | PASS |  |
| dialogs: the dialog fits and is clickable at 1920x1040 | PASS |  |
| dialogs: the dialog fits and is clickable at 390x844 | PASS |  |
| dialogs: the buttons stack on a phone | PASS |  |
| dialogs: the dialog is readable in light mode | PASS |  |
| dialogs: the dialog is readable in dark mode | PASS |  |
| dialogs: there is no animation with reduced motion | PASS |  |
| dialogs: opening and closing the dialog causes no console errors | PASS |  |
| dialogs: held cart: the dialog says the current cart will be removed | PASS |  |
| dialogs: held cart: cancelling keeps the current cart and the held cart | PASS |  |
| dialogs: held cart: confirming replaces the current cart | PASS |  |
| dialogs: held cart: with an empty cart no dialog appears | PASS |  |
| dialogs: similar product: the dialog names both products | PASS |  |
| dialogs: similar product: going back adds nothing and keeps the form open | PASS |  |
| dialogs: similar product: confirming adds it | PASS |  |
| dialogs: similar product: renaming an existing product says save, not add | PASS |  |
| dialogs: category delete: the dialog says what will happen | PASS |  |
| dialogs: category delete: cancelling keeps the category | PASS |  |
| dialogs: category delete: Escape closes the dialog but not the category list | PASS |  |
| dialogs: category delete: confirming deletes it | PASS |  |
| dialogs: unit alert: it has one button and the right message | PASS |  |
| dialogs: unit alert: closing it with the button puts the unit back | PASS |  |
| dialogs: unit alert: closing it with Escape puts the unit back | PASS |  |
| dialogs: void notice: it shows, and the page reloads once it is closed | PASS |  |
| dialogs: an alert waits for an open dialog instead of being lost | PASS |  |
| card-reader: a 4-character burst at 5 ms is recognized | PASS |  |
| card-reader: a 8-character burst at 5 ms is recognized | PASS |  |
| card-reader: a 10-character burst at 5 ms is recognized | PASS |  |
| card-reader: a 13-character burst at 5 ms is recognized | PASS |  |
| card-reader: a 4-character burst at 20 ms is recognized | PASS |  |
| card-reader: a 8-character burst at 20 ms is recognized | PASS |  |
| card-reader: a 10-character burst at 20 ms is recognized | PASS |  |
| card-reader: a 13-character burst at 20 ms is recognized | PASS |  |
| card-reader: a 4-character burst at 35 ms is recognized | PASS |  |
| card-reader: a 8-character burst at 35 ms is recognized | PASS |  |
| card-reader: a 10-character burst at 35 ms is recognized | PASS |  |
| card-reader: a 13-character burst at 35 ms is recognized | PASS |  |
| card-reader: typing at 80 ms is never recognized, even with Enter at the end | PASS |  |
| card-reader: typing at 150 ms is never recognized, even with Enter at the end | PASS |  |
| card-reader: typing at 300 ms is never recognized, even with Enter at the end | PASS |  |
| card-reader: leading zeros are kept | PASS |  |
| card-reader: a Tab can end a burst | PASS |  |
| card-reader: lowercase hex is shown exactly as it was sent | PASS |  |
| card-reader: too short and too long are not cards | PASS |  |
| card-reader: characters a card cannot contain are rejected but still shown | PASS |  |
| card-reader: the test panel shows length, digits, timing and terminator | PASS |  |
| card-reader: the test panel keeps the last 5 taps, newest first | PASS |  |
| card-reader: the test panel shows a reader that sends no terminator | PASS |  |
| card-reader: the test panel text can be selected and stops when asked | PASS |  |
| card-reader: the test panel copies the whole result as text | PASS |  |
| card-reader: the test panel explains a short tap with no terminator | PASS |  |
| card-reader: the sanitizer keeps the exact text, uppercased, and rejects anything else | PASS |  |
| card-reader: Settings has no console errors after a test tap | PASS |  |
| card-reader: a customer with no card stays byte-identical after load and after a save | PASS |  |
| card-reader: a card code is saved on the right customer, next to the phone card | PASS |  |
| card-reader: a customer can have both a phone card and a USB card | PASS |  |
| card-reader: a second customer cannot take the same card | PASS |  |
| card-reader: a save cannot give two customers the same card | PASS |  |
| card-reader: a card code that is not valid is refused | PASS |  |
| card-reader: a points change keeps the card code | PASS |  |
| card-reader: backup and restore keep the card code, and an older backup still restores | PASS |  |
| card-reader: a card tapped with nothing focused selects the customer and leaves the cart alone | PASS |  |
| card-reader: a card tapped in the Checkout search box leaves the box as it was | PASS |  |
| card-reader: a card tapped in the amount box leaves it as it was | PASS |  |
| card-reader: typing a customer's card number by hand is not a card | PASS |  |
| card-reader: an all-digit barcode no customer owns still adds the product | PASS |  |
| card-reader: a letters barcode no customer owns still adds the product | PASS |  |
| card-reader: an unknown code at Checkout gets the normal barcode message | PASS |  |
| card-reader: the Scan tab says waiting for a card, and never the red message | PASS |  |
| card-reader: a registered card shows the customer, the same as a phone tap | PASS |  |
| card-reader: a registered card works in the search box on the All Sukis tab | PASS |  |
| card-reader: an unknown card shows the message, and attaching saves it on the right customer | PASS |  |
| card-reader: on the All Sukis tab an unknown code is left alone | PASS |  |
| card-reader: Add Suki: the button captures a card and it is saved with the customer | PASS |  |
| card-reader: Add Suki: a card scanned in the name box leaves it as it was and does not submit | PASS |  |
| card-reader: a card tapped in a customer name box leaves it as it was | PASS |  |
| card-reader: Add Suki: a card someone else owns is reported and not kept | PASS |  |
| card-reader: Add Suki: Cancel stops the capture cleanly | PASS |  |
| card-reader: Add Suki: the capture times out after 15 seconds | PASS |  |
| card-reader: closing Add Suki stops a capture | PASS |  |
| card-reader: edit customer: the button attaches a card, and reports a duplicate | PASS |  |
| card-reader: the phone NFC path still works, and shows no USB controls | PASS |  |
| card-reader: a fresh Suki Rewards page claims nothing about the reader | PASS |  |
| card-reader: a fresh Checkout page claims nothing about the reader | PASS |  |
| card-reader: a fresh Settings page claims nothing about the reader | PASS |  |
| card-reader: a good read says Reader working with the time, on every page | PASS |  |
| card-reader: an unknown card also counts as a read | PASS |  |
| card-reader: a duplicate card also counts as a read | PASS |  |
| card-reader: human typing never counts as a read | PASS |  |
| card-reader: a barcode no customer owns never counts as a read | PASS |  |
| card-reader: silence changes nothing, after a read or before one | PASS |  |
| card-reader: Checkout: Tap Suki's Card arms card mode for 30 seconds, with no NFC error | PASS |  |
| card-reader: Checkout: Cancel ends card mode | PASS |  |
| card-reader: Checkout: a registered card in card mode selects the customer | PASS |  |
| card-reader: Checkout: an unknown card in card mode can be attached, and never says barcode | PASS |  |
| card-reader: Scan tab: the NFC icon arms card mode for 30 seconds, with no NFC error | PASS |  |
| card-reader: Add Suki: the NFC icon starts the USB capture, with no NFC error | PASS |  |
| card-reader: the customer panel offers no NFC link on a laptop | PASS |  |
| card-reader: Remove card: the dialog names the customer and the card | PASS |  |
| card-reader: Remove card: Cancel changes nothing | PASS |  |
| card-reader: Remove card: the card goes and every other field is byte-identical | PASS |  |
| card-reader: Replace card: a new tap takes the old card's place | PASS |  |
| card-reader: Inventory: a registered card leaves the search box alone and shows a note | PASS |  |
| card-reader: Inventory: a barcode nobody owns still filters as it does today | PASS |  |
| card-reader: Reports: a registered card leaves a focused field alone and shows a note | PASS |  |
| card-reader: Inventory has no console errors or failed requests after a tap | PASS |  |
| card-reader: Reports has no console errors or failed requests after a tap | PASS |  |
| card-reader: with Web NFC the Android wording and behaviour are unchanged | PASS |  |
| card-reader: no terminator: a registered card is accepted and the field is put back | PASS |  |
| card-reader: no terminator: a late Enter from the same card does nothing | PASS |  |
| card-reader: no terminator: an unknown card in card mode is accepted | PASS |  |
| card-reader: no terminator: a code nobody owns stays in the search box, out of card mode | PASS |  |
| card-reader: no terminator: a code under 6 characters is not a card | PASS |  |
| card-reader: no terminator: human typing of a registered code is not a card | PASS |  |
| card-reader: a registered card sends nothing and stores nothing on Suki Rewards | PASS |  |
| card-reader: attaching a card sends nothing and writes only that customer's new field | PASS |  |
| card-reader: a card at Checkout sends nothing and only updates the cart draft | PASS |  |
| card-reader: a test tap sends nothing and stores nothing | PASS |  |
| card-reader: Checkout has no console errors or failed requests after a tap | PASS |  |
| card-reader: Suki Rewards has no console errors or failed requests after a tap | PASS |  |
| card-duplicates: a stale list cannot put a stored card on a second customer | PASS |  |
| card-duplicates: a stale list cannot remove a card | PASS |  |
| card-duplicates: two saves from one moment: the first wins and the second is refused | PASS |  |
| card-duplicates: two real tabs: the second is refused once it can see the first | PASS |  |
| card-duplicates: Add Suki refuses a card that was taken after it was captured | PASS |  |
| card-duplicates: the same card on a second customer is refused, whatever its case or spaces | PASS |  |
| card-duplicates: a save that keeps a customer's own code still works | PASS |  |
| card-duplicates: changing only the name never touches the code | PASS |  |
| card-duplicates: an old duplicate does not block edits to anyone | PASS |  |
| card-duplicates: a duplicate backs up the raw list once, and nothing changes | PASS |  |
| card-duplicates: the notice names the card, both customers, and offers a button for each | PASS |  |
| card-duplicates: no notice shows when every card has one owner | PASS |  |
| card-duplicates: Decide later changes nothing | PASS |  |
| card-duplicates: keeping the card for one customer takes it from the other, and nothing else changes | PASS |  |
| card-duplicates: three customers on one card are all offered | PASS |  |
| card-duplicates: codes differing only in case or spaces count as a duplicate | PASS |  |
| card-duplicates: an ambiguous card at Checkout selects nobody, and a sale earns no points | PASS |  |
| card-duplicates: an ambiguous card clears a customer who was already selected | PASS |  |
| card-duplicates: an ambiguous card in Checkout card mode selects nobody and offers no attach | PASS |  |
| card-duplicates: an ambiguous card on the Scan tab shows nobody | PASS |  |
| card-duplicates: a card with one owner still works beside a duplicate | PASS |  |
| card-duplicates: a restore with a duplicate warns and enters the resolve flow | PASS |  |
| card-duplicates: leading zeros survive save, reload, backup and restore | PASS |  |
| card-duplicates: Checkout has no console errors with a duplicate stored | PASS |  |
| card-duplicates: Suki Rewards has no console errors with a duplicate stored | PASS |  |
| card-duplicates: badge for none: All Sukis list | PASS |  |
| card-duplicates: badge for none: customer detail | PASS |  |
| card-duplicates: badge for none: Checkout customer panel | PASS |  |
| card-duplicates: badge for USB only: All Sukis list | PASS |  |
| card-duplicates: badge for USB only: customer detail | PASS |  |
| card-duplicates: badge for USB only: Checkout customer panel | PASS |  |
| card-duplicates: badge for phone only: All Sukis list | PASS |  |
| card-duplicates: badge for phone only: customer detail | PASS |  |
| card-duplicates: badge for phone only: Checkout customer panel | PASS |  |
| card-duplicates: badge for both: All Sukis list | PASS |  |
| card-duplicates: badge for both: customer detail | PASS |  |
| card-duplicates: badge for both: Checkout customer panel | PASS |  |
| card-duplicates: the edit screen shows the full code, leading zeros and all, with Remove card | PASS |  |
| card-duplicates: the list can be searched by a USB card code, and filtered by having a card | PASS |  |
| card-duplicates: the active cards count includes USB cards | PASS |  |
| card-duplicates: the Scan tab shows which card was read | PASS |  |
| card-duplicates: after a read the status shows no caret and nothing typeable is focused | PASS |  |
| card-duplicates: a field the person focused keeps its focus and its caret after a read | PASS |  |
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
| requests: no app request failed at any point in the run | PASS |  |

## Known bugs

These are reported, not fixed, and never affect the exit code.

| Test | Result | Reason |
|---|---|---|
| known-bugs: shift cash: a P65 cash sale paid with P100 adds P65 to the shift | STILL FAILS | shift cash sales: expected 65, got 100 |
| known-bugs: shift cash: the sale records P65 cash, not the P100 tendered | STILL FAILS | cash on the sale: expected 65, got 100 |
| known-bugs: shift cash: a card sale adds nothing to shift cash | STILL FAILS | shift cash sales: expected 0, got 65 |
| known-bugs: close shift: Cancel leaves the shift open | STILL FAILS | open shift: expected "S", got null |
| known-bugs: close shift: a blank amount leaves the shift open | STILL FAILS | open shift: expected "S", got null |
| known-bugs: reports today: a 7 AM sale counts as today | STILL FAILS | today's revenue: expected "₱100.00", got "₱0.00" |
| known-bugs: reports today: at 7:30 AM, yesterday's sale is not counted as today | STILL FAILS | today's revenue: expected "₱0.00", got "₱40.00" |
| known-bugs: trends: the comparison uses yesterday's real sales | STILL FAILS | revenue note: expected to contain "50% vs yesterday revenue", got "▲ 100% vs yesterday revenue" |
| known-bugs: trends: the 7-day trend shows all 7 days with the Today filter on | STILL FAILS | last 7 days: expected [0,25,0,0,0,100,150], got [0,0,0,0,0,0,150] |
| known-bugs: void: with a category filter on, every item's stock comes back | STILL FAILS | stock after the void: expected [10,10], got [10,7] |
| known-bugs: exports: voided sales are left out | STILL FAILS | exported sales: expected ["kept"], got ["kept","gone"] |
| known-bugs: hold: holding a cart clears the Suki customer | STILL FAILS | selected customer: expected "", got "s1" |
| known-bugs-login: login check: settings sends a signed-out visitor to the login page | STILL FAILS | Timed out waiting for settings to send a signed-out visitor to login |
| known-bugs-login: login check: suki-reward sends a signed-out visitor to the login page | STILL FAILS | Timed out waiting for suki-reward to send a signed-out visitor to login |
| known-bugs-login: hidden: nothing marked hidden is on screen on index | STILL FAILS | On screen: total |
| known-bugs-login: hidden: nothing marked hidden is on screen on reports | STILL FAILS | On screen: reportCustomRange |
| known-bugs-login: hidden: nothing marked hidden is on screen on settings | STILL FAILS | On screen: removeLogo |

## Mutation check

`tests/mutations.js` has 87 mutations and 9 trial fixes. Every mutation was caught when last run, and run them again with `node tests/mutate.js`.

| Mutation | Fix it reverts | Tests |
|---|---|---|
| `stale-line-total` | A fixed-price line is priced from its quantity (4ade2e6) | 1 |
| `reward-ignores-points` | One reward amount for screen and sale, limited by the points (a165fe2) | 1 |
| `draft-drops-line-total` | Measured drafts save the running total (f9ecd73) | 1 |
| `measured-keeps-last-amount` | Measured lines keep the running total, not the last entry (f9ecd73, fully reverted) | 2 |
| `draft-kept-after-sale` | A finished sale clears the draft | 1 |
| `no-premigration-backup` | Suki migration backs up the original list first | 1 |
| `no-shrink-guard` | Saves that lose customers are refused | 2 |
| `backup-filename-utc` | Backup filename uses the store timezone | 1 |
| `no-restore-rollback` | A failed restore puts every key back | 1 |
| `no-backup-before-reset` | Reset backs up first | 2 |
| `no-backup-shape-check` | Broken backup files are rejected | 1 |
| `no-false-corruption-cleanup` | False corruption backups are removed on load | 1 |
| `no-corruption-dedupe` | The same corruption is backed up once | 1 |
| `stock-write-no-undo` | Stock and history are written atomically | 1 |
| `products-always-write` | products() is read-only unless normalization changed data | 1 |
| `missing-date-expires` | Missing dates never remove points (1d74e6e) | 2 |
| `cart-icon-in-picker` | The cart icon is not in the picker | 1 |
| `no-legacy-cart-alias` | Old cart ids move to the right PNG | 1 |
| `tooltip-no-focus` | The tooltip works from the keyboard | 2 |
| `category-rows-squeezed` | Manage Categories rows keep their full height | 5 |
| `empty-message-always-on` | The empty message respects hidden | 1 |
| `sold-out-counted-twice` | A sold-out item is counted once | 1 |
| `icon-alias-inherited-names` | Icon lookups ignore inherited names | 3 |
| `icon-path-inherited-names` | Icon lookups ignore inherited names | 1 |
| `no-icon-remigration` | Stores that already ran the migration are cleaned too | 1 |
| `favicon-dead-link` | Each page declares an icon that exists | 1 |
| `favicon-removed` | Each page declares an icon that exists | 2 |
| `reset-brings-seeds-back` | Reset keeps seed products out | 3 |
| `restore-keeps-file-deleted-list` | Restore brings back exactly the products in the file | 3 |
| `helper-defined-twice` | One shared copy of each helper | 1 |
| `lexical-redeclaration` | No page declares the same name twice | 2 |
| `low-stock-threshold-changed` | Low-stock results stay the same | 2 |
| `sale-drops-earned-points` | A sale that redeems keeps its earned points | 1 |
| `stored-balance-shown` | Every screen shows the derived balance | 1 |
| `expired-points-revive` | Expired points are written off before a change | 2 |
| `stale-save-changes-points` | Only applyPointsChange changes points | 2 |
| `void-repeats` | A void only reverses once | 1 |
| `void-no-shortfall-floor` | A void floors at zero and records the shortfall | 1 |
| `void-outside-rollback` | A failed void also restores points | 1 |
| `void-recalculates` | A void uses the values on the sale | 1 |
| `migration-no-backup` | The migration backs up first and refuses without a backup | 2 |
| `migration-keeps-stamps-only` | The migration keeps the higher value | 1 |
| `migration-switched-on` | The migration stays off until approved | 1 |
| `dialog-cancel-resets` | Cancel changes nothing | 3 |
| `dialog-no-focus-return` | Focus returns to the opening button | 1 |
| `dialog-no-escape` | Escape means Cancel | 1 |
| `dialog-scroll-stays-locked` | The scroll lock is released | 1 |
| `dialog-no-focus-trap` | Tab stays inside the dialog | 1 |
| `dialog-stacks` | Only one dialog at a time | 1 |
| `dialog-focus-on-action` | A danger dialog starts on the safe button | 1 |
| `dialog-error-leaves-page-stuck` | An error never leaves the page stuck | 1 |
| `native-confirm-returns` | No browser confirm or alert remains | 1 |
| `native-alert-returns` | No browser confirm or alert remains | 1 |
| `held-cart-ignores-cancel` | Cancel keeps the current cart | 1 |
| `similar-product-ignores-cancel` | Go back adds nothing | 1 |
| `category-delete-ignores-cancel` | Keep category keeps it | 1 |
| `alert-before-reset-lost` | An alert waits for an open dialog | 1 |
| `card-speed-limit-removed` | Human typing is not a card | 1 |
| `card-duplicate-allowed` | Two customers never share a card | 2 |
| `card-field-not-repaired` | Card digits never stay in a field | 3 |
| `card-swallows-barcodes` | Anything that is not a card stays a barcode | 2 |
| `card-enter-submits` | A card does not submit the form | 1 |
| `reader-says-ready-at-load` | A page never claims the reader works before a read | 3 |
| `nfc-button-says-unsupported` | The buttons arm card mode on a laptop | 1 |
| `scan-icon-says-unsupported` | The buttons arm card mode on a laptop | 1 |
| `human-typing-counts-as-read` | Only a recognized card counts as a read | 1 |
| `no-terminator-rule-dropped` | A reader with no Enter or Tab still works | 2 |
| `card-mode-condition-dropped` | Without card mode or an owner, a code stays a barcode | 2 |
| `no-terminator-human-accepted` | Human typing is not a card, even with no terminator | 1 |
| `card-sent-away` | A card code never leaves the page | 1 |
| `card-stored-by-reader` | The reader stores nothing | 1 |
| `remove-card-ignores-cancel` | Keep card keeps it | 1 |
| `no-note-on-other-pages` | Other pages keep card digits out of their fields | 1 |
| `card-always-fires-change` | An unchanged field fires no event | 1 |
| `card-no-fresh-read` | A write checks the stored list, not an in-memory copy | 2 |
| `stale-list-drops-card` | A stale list cannot delete a card | 1 |
| `old-duplicate-blocks-edits` | An old duplicate does not block other edits | 1 |
| `ambiguous-card-guesses` | An ambiguous card selects nobody | 2 |
| `restore-hides-duplicate` | A restore reports duplicates | 1 |
| `no-duplicate-backup` | The list is backed up before anything changes | 1 |
| `keep-card-ignores-cancel` | Decide later changes nothing | 1 |
| `badge-ignores-card-code` | Badges show USB cards | 3 |
| `caret-stays-after-read` | A read leaves no caret behind | 1 |
| `caret-color-removed` | Status text never shows a caret | 1 |
| `overlay-no-delay` | The overlay waits 300 ms | 1 |
| `overlay-stuck-after-back` | The overlay clears when a page is restored | 1 |
| `overlay-no-offline-message` | Offline shows its own message | 1 |
