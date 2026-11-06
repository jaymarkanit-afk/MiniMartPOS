# Mini Mart POS tests

Run everything with one command from the project folder:

```
node tests/run.js
```

It prints a table of every test with PASS or FAIL and the reason for any failure. The exit code is 0 when everything passes and 1 when anything fails. Exit code 2 means the run itself could not finish.

It needs Node 18 or newer and the installed Chrome. There is nothing to install. If Chrome is somewhere unusual, set `CHROME_PATH` to its location. A full run takes about 5 minutes. Most suites run side by side, and the overlay and page suites run alone.

## Safety

- Each run uses a new temporary Chrome profile, never your real browser data. It is deleted when the run ends, including after a failed or timed-out test.
- Each test starts with empty browser storage.
- The internet is blocked for the test browser. `cdn.jsdelivr.net`, `fonts.googleapis.com` and `fonts.gstatic.com` are the only failed requests allowed, and they fail on purpose.
- No test changes a file in the project.

## Options

| Command | What it does |
|---|---|
| `node tests/run.js --only=checkout` | Runs tests whose "suite: name" matches the pattern |
| `node tests/run.js --json=results.json` | Also saves the results as JSON |
| `node tests/mutate.js` | Runs the mutation check |
| `node tests/mutate.js --id=stale-line-total` | Runs one mutation |

## Mutation check

A test that cannot fail is not proof. `node tests/mutate.js` reverts one fix at a time and confirms that the test covering it fails. Each check opens only the suites it needs, in one shared Chrome.

The test server changes the code as it serves it, so no file on disk ever changes, and a crash cannot leave a reverted fix behind. The script first confirms that each test passes on the real code, so a test that was already failing cannot count as catching a mutation.

The mutations are listed in `mutations.js`. When a fix changes the code a mutation matches, the run stops and names that mutation, and it needs updating.

## Known bugs

The KNOWN BUGS section lists open bugs that are not fixed yet. Those tests print STILL FAILS or NOW PASSES and never change the exit code. When a fix lands, move its test into the main suite.

`node tests/mutate.js --known` fixes each known bug in memory and confirms its test goes from failing to passing, so these tests are proven to fail because of the bug.

## Layout

| Path | Contents |
|---|---|
| `run.js` | Starts the server and Chrome, runs the suites, prints the table |
| `mutate.js`, `mutations.js` | Mutation check |
| `browser/` | Tests that run inside Chrome against the real pages, in a same-origin iframe |
| `node/` | Tests driven from outside the page, with real mouse and keyboard input |
| `lib/` | Server, Chrome launcher, DevTools client and in-page test helpers |
| `fixtures/suki-preview.js` | The read-only Suki preview script, so tests can compare it with the rules |

## Writing a test

In `browser/`, a test loads real pages and checks real stored data:

```js
test("a sale records its total", async () => {
  await fresh();                 // empty storage, signed in
  await go("index.html");        // load the real page
  e("addProductToCart(window.miniMartDB.products()[0]);"); // run code in the page
  eq(e("cart.size"), 1, "cart"); // expected value, with a label for the failure
});
```

Any uncaught error on a page fails the running test automatically.

When the code disagrees with an approved rule, keep the test failing and report it. Do not change the expected value to match the code.

## What these tests cannot prove

- **NFC cards:** the Web NFC reader needs real hardware. Card id storage and lookup are tested.
- **Barcode scanners:** a physical scanner is not tested.
- **Printing:** receipts on real paper, and the browser print dialog, are not tested.
- **Real login:** tests use the local demo session. Supabase is blocked, so a real sign-in is not tested.
- **Fonts and CDN scripts:** they are blocked, so pages are tested with fallback fonts and no Supabase library.
- **Layout and appearance:** tests check behaviour, not how a page looks.
- **Other browsers and devices:** only desktop Chrome, in headless mode, is tested.
- **Real browser storage limits:** the near-full store test uses a 4.9 MB filler, and other failures are simulated.
- **A real offline navigation:** with no connection, Chrome shows its own error page instead of the app, so the offline message is tested on a slow in-page action.
- **Downloaded files:** file contents are read in the page before the download. Opening an exported Excel or PDF file is not tested.
