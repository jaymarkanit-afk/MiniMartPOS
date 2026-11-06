"use strict";
// Every page, loaded with no test instrumentation at all. The only allowed failures are
// the external hosts the suite blocks on purpose.
const { BLOCKED_HOSTS } = require("../lib/chrome");

const PAGES = ["index", "inventory", "reports", "settings", "suki-reward", "login"];
const isBlocked = (problem) => BLOCKED_HOSTS.some((host) => `${problem.text} ${problem.url || ""}`.includes(host));

const tests = PAGES.map((name) => ({
  name: `${name} loads with no console errors or failed requests`,
  run: async ({ page, server }) => {
    server.hook = false;
    await page.seed({}, { signedIn: name !== "login" });
    await page.goto(`${name}.html`, 900);
    const location = await page.eval("location.pathname");
    if (location !== `/${name}.html`) throw new Error(`Redirected to ${location}`);
    const problems = page.problems.filter((problem) => !isBlocked(problem));
    if (problems.length) {
      throw new Error(problems.map(({ kind, text }) => `${kind}: ${text}`).join(" | ").slice(0, 600));
    }
    const failed = server.requests.filter(({ status }) => status >= 400).map(({ url, status }) => `${status} ${url}`);
    server.requests.length = 0;
    if (failed.length) throw new Error(`Failed requests: ${failed.join(", ")}`);
  },
}));

for (const name of PAGES) {
  tests.push({
    name: `${name} declares an icon that loads`,
    run: async ({ page, server }) => {
      await page.seed({}, { signedIn: name !== "login" });
      await page.goto(`${name}.html`, 200);
      const icon = await page.eval(async () => {
        const link = document.querySelector('link[rel="icon"]');
        if (!link) return null;
        const reply = await fetch(link.href);
        return { href: link.getAttribute("href"), status: reply.status, type: reply.headers.get("content-type") };
      });
      const expected = JSON.stringify({ href: "Icons/grocery-store.png", status: 200, type: "image/png" });
      if (JSON.stringify(icon) !== expected) throw new Error(`Expected ${expected}, got ${JSON.stringify(icon)}`);
      if (server.requests.some(({ url }) => url === "/favicon.ico")) throw new Error("The browser still asked for /favicon.ico");
    },
  });
}

module.exports = { tests };
