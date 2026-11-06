"use strict";
// KNOWN BUGS that need a real page load. See browser/known-bugs.js.
const tests = [];

for (const name of ["settings", "suki-reward"]) {
  tests.push({
    name: `login check: ${name} sends a signed-out visitor to the login page`,
    run: async ({ page }) => {
      await page.seed({}, { signedIn: false });
      // A redirect interrupts the load, so watch where the page ends up.
      await page.send("Page.navigate", { url: page.url(`${name}.html`) });
      await page.until("location.pathname==='/login.html'", { timeout: 2500, label: `${name} to send a signed-out visitor to login` });
    },
  });
}

// Found while fixing the empty category message. CSS display rules can override hidden.
for (const name of ["index", "reports", "settings"]) {
  tests.push({
    name: `hidden: nothing marked hidden is on screen on ${name}`,
    run: async ({ page }) => {
      await page.seed();
      await page.goto(`${name}.html`, 500);
      const shown = await page.eval(() => [...document.querySelectorAll("[hidden]")]
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => element.id || element.className));
      if (shown.length) throw new Error(`On screen: ${shown.join(", ")}`);
    },
  });
}

module.exports = { tests };
