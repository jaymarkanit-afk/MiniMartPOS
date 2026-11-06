"use strict";
// Runs inside Chrome. Each app page loads in a same-origin iframe, so a test can read
// the app's own state directly. Any uncaught page error fails the running test.
const SUITE = new URLSearchParams(location.search).get("suite");
const ONLY = new URLSearchParams(location.search).get("only");
const SESSION = JSON.stringify({
  user: { id: "x", email: "admin@gmail.com", email_confirmed_at: "2026-01-01T00:00:00.000Z", user_metadata: {} },
  access_token: "t",
});
const tests = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mkFrame = () => {
  const frame = document.createElement("iframe");
  frame.style.cssText = "width:1200px;height:800px";
  document.body.append(frame);
  return frame;
};
const F = mkFrame();
let errs = [];
let dl = [];
let logs = [];
let early = null;
let allowErrors = false;

window.__hook = (w) => {
  w.__c = { set: [], rem: [] };
  const proto = w.Storage.prototype;
  const setItem = proto.setItem;
  const removeItem = proto.removeItem;
  proto.setItem = function setItemCounted(key, value) {
    if (key !== "miniMartBackupHeadroomProbe") w.__c.set.push(key);
    return setItem.call(this, key, value);
  };
  proto.removeItem = function removeItemCounted(key) {
    w.__c.rem.push(key);
    return removeItem.call(this, key);
  };
  w.addEventListener("error", (event) => errs.push(String(event.message)));
  w.addEventListener("unhandledrejection", (event) => errs.push(`rejection: ${event.reason}`));
  const info = w.console.info.bind(w.console);
  w.console.info = (...args) => {
    logs.push(args.join(" "));
    info(...args);
  };
  const click = w.HTMLAnchorElement.prototype.click;
  w.HTMLAnchorElement.prototype.click = function clickRecorded() {
    if (this.download) {
      const record = { name: this.download };
      dl.push(record);
      record.ready = w.fetch(this.href)
        .then((reply) => reply.text())
        .then((body) => { record.text = body; })
        .catch(() => {});
    }
    return click.call(this);
  };
  if (early) early(w);
};

// Signed-in pages finish their login check after the page's own start-up.
const pageIsReady = (w) => w.miniMartInitialDataReady &&
  (w.miniMartAuthReady || !/\/(index|inventory|reports)\.html/.test(w.location.pathname));
const waitForPage = async (frame) => {
  const deadline = Date.now() + 2000;
  while (!pageIsReady(frame.contentWindow) && Date.now() < deadline) await sleep(10);
  await sleep(40);
};
// With no wait given, this returns as soon as the page says it is ready.
const go = (url, wait = null, frame = F) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Page did not load: ${url}`)), 20000);
  frame.onload = async () => {
    clearTimeout(timer);
    frame.onload = null;
    await (wait === null ? waitForPage(frame) : sleep(wait));
    resolve();
  };
  frame.src = url;
});
const goEarly = async (url, setup, wait = null) => {
  early = setup;
  try {
    await go(url, wait);
  } finally {
    early = null;
  }
};
const fresh = async () => {
  await go("about:blank", 20);
  localStorage.clear();
  localStorage.setItem("miniMartLocalDemoSession", SESSION);
  errs = [];
  dl = [];
  logs = [];
};
const e = (code, frame = F) => frame.contentWindow.eval(code);
const $ = (id) => F.contentDocument.getElementById(id);
const L = (key, value) => localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
const J = (key) => JSON.parse(localStorage.getItem(key) || "null");
const text = (id) => $(id).textContent;
const banner = () => F.contentDocument.getElementById("storageWarning")?.querySelector("span").textContent ?? null;
const storageToast = () => [...F.contentDocument.querySelectorAll(".storage-error")].at(-1)?.textContent ?? null;
const checkoutToast = () => [...F.contentDocument.querySelectorAll(".checkout-toast")].at(-1)?.textContent ?? null;
const failWrites = (match) => {
  const w = F.contentWindow;
  const original = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function setItemFailing(key, value) {
    if (match(key, value)) throw new w.DOMException("full", "QuotaExceededError");
    return original.call(this, key, value);
  };
  return () => { w.Storage.prototype.setItem = original; };
};
const storeDate = (timeZone, date = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value === undefined ? null : value;
}
const show = (value) => {
  const shown = JSON.stringify(canonical(value));
  return shown && shown.length > 400 ? `${shown.slice(0, 400)}...` : shown;
};
function eq(actual, expected, label = "value") {
  if (JSON.stringify(canonical(actual)) !== JSON.stringify(canonical(expected))) {
    throw new Error(`${label}: expected ${show(expected)}, got ${show(actual)}`);
  }
}
function ok(condition, label) {
  if (!condition) throw new Error(label);
}
function has(actual, expected, label = "text") {
  if (!String(actual).includes(expected)) {
    throw new Error(`${label}: expected to contain ${show(expected)}, got ${show(actual)}`);
  }
}
const dialog = () => F.contentDocument.querySelector(".confirm-dialog");
// Answers an in-app dialog if one is open, with a click on its action button.
const acceptDialog = async () => {
  await sleep(20);
  if (!dialog()) return;
  dialog().querySelector(".is-confirm").click();
  await sleep(40);
};
const test = (name, run, { timeout = 60000 } = {}) => tests.push({ name, run, timeout });
const expectPageErrors = () => { allowErrors = true; };

const report = (result) => fetch("/__result", { method: "POST", body: JSON.stringify(result) });

async function runSuite() {
  const filter = ONLY ? new RegExp(ONLY, "i") : null;
  for (const { name, run, timeout } of tests) {
    if (filter && !filter.test(`${SUITE}: ${name}`)) continue;
    const started = Date.now();
    errs = [];
    allowErrors = false;
    let reason = "";
    let timer;
    try {
      await Promise.race([
        run(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Timed out after ${timeout} ms`)), timeout);
        }),
      ]);
      if (errs.length && !allowErrors) reason = `Uncaught page error: ${errs.join(" | ")}`;
    } catch (error) {
      reason = String(error.message || error);
    }
    clearTimeout(timer);
    await report({ suite: SUITE, name, ok: !reason, reason, ms: Date.now() - started });
  }
  await report({ suite: SUITE, done: true, loaded: tests.length });
}
