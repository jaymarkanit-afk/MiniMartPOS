"use strict";
// Loading overlay, driven by real clicks and a server that can be slow. Chrome holds
// DevTools commands while a navigation is pending, so the page logs its own overlay
// changes to sessionStorage, and the tests read that log once the navigation is done.
const { sleep } = require("../lib/cdp");

const RECORDER = `(() => {
  const pageName = location.pathname;
  let last = "";
  const read = () => JSON.parse(sessionStorage.getItem("__overlay") || "[]");
  const check = () => {
    const overlay = document.querySelector(".loading-overlay");
    const actions = overlay?.querySelector(".loading-actions");
    const state = {
      visible: Boolean(overlay && !overlay.hidden),
      slow: Boolean(overlay?.classList.contains("is-slow")),
      message: overlay && !overlay.hidden ? overlay.querySelector(".loading-message").textContent : "",
      actions: Boolean(actions && !actions.hidden),
    };
    const key = JSON.stringify(state);
    if (key === last) return;
    last = key;
    sessionStorage.setItem("__overlay", JSON.stringify([...read(), {
      ...state,
      page: pageName,
      at: Math.round(performance.now() - (window.__clickedAt ?? 0)),
    }]));
  };
  new MutationObserver(check).observe(document, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["hidden", "class"],
  });
  addEventListener("click", () => { window.__clickedAt = performance.now(); }, true);
  addEventListener("pageshow", (event) => { sessionStorage.setItem("__persisted", String(event.persisted)); });
})();`;

const IS_SLOW = "document.querySelector('.loading-overlay').classList.contains('is-slow')";
// The real 8-second wait has its own test, so these only need the message to appear.
const SLOW_SOON = "void window.showLoading('Working',{slowAfter:200})";
const NAV_LINK = 'a[href="reports.html"]';
const overlayLog = (page) => page.eval("JSON.parse(sessionStorage.getItem('__overlay')||'[]')");
const overlayVisible = (page) => page.eval("(()=>{const o=document.querySelector('.loading-overlay');return Boolean(o&&!o.hidden)})()");
const message = (page) => page.eval("document.querySelector('.loading-message').textContent");
const actionsVisible = (page) => page.eval("(()=>{const a=document.querySelector('.loading-actions');return !a.hidden&&a.getBoundingClientRect().height>0})()");
const fail = (text) => { throw new Error(text); };

const open = async (page, server, { delay = null, keepCache = false } = {}) => {
  if (keepCache) server.noStore = false;
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: RECORDER });
  await page.seed();
  await page.goto("index.html", 500);
  if (delay) server.delays = [{ match: /^\/reports\.html$/, ms: delay }];
};
const clickThrough = async (page, timeout = 15000) => {
  const loaded = page.waitEvent("Page.loadEventFired", timeout);
  await page.click(NAV_LINK);
  await loaded;
};
const firstVisible = async (page) => (await overlayLog(page)).find((entry) => entry.visible);

const tests = [
  {
    name: "a fast navigation never shows the overlay",
    run: async ({ page, server }) => {
      await open(page, server);
      await clickThrough(page);
      await sleep(700);
      const shown = (await overlayLog(page)).filter((entry) => entry.visible);
      if (shown.length) fail(`Overlay flashed: ${JSON.stringify(shown)}`);
      if (await overlayVisible(page)) fail("Overlay visible after load");
    },
  },
  {
    name: "a slow navigation shows the overlay after about 300 ms, then clears it",
    run: async ({ page, server }) => {
      await open(page, server, { delay: 1500 });
      await clickThrough(page);
      await sleep(600);
      const first = await firstVisible(page);
      if (!first) fail("Overlay never appeared");
      if (first.page !== "/index.html") fail(`Overlay appeared on ${first.page}`);
      if (first.at < 280 || first.at > 500) fail(`Overlay appeared at ${first.at} ms, expected about 300`);
      if (first.message !== "Loading...") fail(`Message: ${first.message}`);
      if (await overlayVisible(page)) fail("Overlay stuck after the new page loaded");
    },
  },
  {
    name: "pressing Back after a slow navigation clears the overlay, from the back-forward cache",
    run: async ({ page, server }) => {
      await open(page, server, { delay: 900, keepCache: true });
      await clickThrough(page);
      await sleep(400);
      if (!(await firstVisible(page))) fail("Overlay should have been up before leaving the page");
      await page.goBack();
      await sleep(900);
      if ((await page.eval("location.pathname")) !== "/index.html") fail("Back did not return to Checkout");
      const persisted = await page.eval("sessionStorage.getItem('__persisted')");
      if (persisted !== "true") fail(`Not restored from the back-forward cache (persisted=${persisted})`);
      if (await overlayVisible(page)) fail("Overlay stuck after Back");
    },
  },
  {
    name: "pressing Back after a fast navigation leaves no overlay",
    run: async ({ page, server }) => {
      await open(page, server, { keepCache: true });
      await clickThrough(page);
      await sleep(400);
      await page.goBack();
      await sleep(900);
      if (await overlayVisible(page)) fail("Overlay stuck after Back");
    },
  },
  {
    name: "pressing Back on a page that is reloaded leaves no overlay",
    run: async ({ page, server }) => {
      await open(page, server, { delay: 900 });
      // An unload handler keeps the page out of the back-forward cache.
      await page.eval("addEventListener('unload',()=>{})");
      await clickThrough(page);
      await sleep(300);
      await page.goBack();
      await sleep(1500);
      if ((await page.eval("location.pathname")) !== "/index.html") fail("Back did not return to Checkout");
      if (await overlayVisible(page)) fail("Overlay stuck after Back");
    },
  },
  {
    name: "after about 8 seconds a slow navigation shows the slow message with Retry and Dismiss",
    run: async ({ page, server }) => {
      await open(page, server, { delay: 9500 });
      await clickThrough(page);
      await sleep(300);
      const log = await overlayLog(page);
      const shown = log.find((entry) => entry.visible);
      const slow = log.find((entry) => entry.slow);
      if (!slow) fail(`Slow message never appeared: ${JSON.stringify(log)}`);
      if (slow.at - shown.at < 7800 || slow.at - shown.at > 8600) fail(`Slow message came ${slow.at - shown.at} ms after the overlay`);
      if (slow.message !== "Taking longer than usual. Check your connection.") fail(`Message: ${slow.message}`);
      if (!slow.actions) fail("Retry and Dismiss were not shown");
    },
  },
  {
    name: "Dismiss closes the slow message",
    run: async ({ page, server }) => {
      await open(page, server);
      await page.eval(SLOW_SOON);
      await page.until(IS_SLOW, { timeout: 9000, label: "the slow message" });
      if (!(await actionsVisible(page))) fail("Retry and Dismiss are not visible");
      const details = await page.eval("document.querySelector('.loading-details').textContent");
      if (details !== "You can retry or dismiss this message.") fail(`Details: ${details}`);
      await page.click(".loading-dismiss");
      await sleep(100);
      if (await overlayVisible(page)) fail("Overlay still visible after Dismiss");
    },
  },
  {
    name: "Retry reloads the page and clears the overlay",
    run: async ({ page, server }) => {
      await open(page, server);
      await page.eval(`window.__sameDocument=true;${SLOW_SOON}`);
      await page.until(IS_SLOW, { timeout: 9000, label: "the slow message" });
      const loaded = page.waitEvent("Page.loadEventFired");
      await page.click(".loading-retry");
      await loaded;
      await sleep(500);
      if (await page.eval("window.__sameDocument===true")) fail("The page did not reload");
      if (await overlayVisible(page)) fail("Overlay stuck after Retry");
    },
  },
  {
    name: "offline, a slow action shows the offline message",
    run: async ({ page, server }) => {
      await open(page, server);
      await page.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await page.eval(SLOW_SOON);
      await page.until(IS_SLOW, { timeout: 9000, label: "the slow message" });
      const text = await message(page);
      if (text !== "You are offline") fail(`Message: ${text}`);
      if (!(await actionsVisible(page))) fail("Retry and Dismiss are not visible");
    },
  },
  {
    name: "a finished action hides the overlay",
    run: async ({ page, server }) => {
      await open(page, server);
      await page.eval("window.withLoading('Working',()=>new Promise(r=>setTimeout(r,100)))");
      if (await overlayVisible(page)) fail("Overlay stuck after the action finished");
    },
  },
  {
    name: "a failed action shows an error, then clears",
    run: async ({ page, server }) => {
      await open(page, server);
      await page.eval("window.withLoading('Working',()=>Promise.reject(new Error('x'))).catch(()=>{})");
      if ((await message(page)) !== "Could not complete: working.") fail(`Message: ${await message(page)}`);
      await page.until("document.querySelector('.loading-overlay').hidden===true", { timeout: 6000, label: "the error to clear" });
    },
  },
];

module.exports = { tests };
