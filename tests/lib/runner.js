"use strict";
// Runs suites in one Chrome. run.js and mutate.js both use this, so a mutation run only
// opens the suites it needs. If Chrome stops responding it is restarted, the affected
// tests rerun once, and the run reports that it happened.
const { launch } = require("./chrome");
const { createServer } = require("./server");
const { Page } = require("./cdp");

const BROWSER_SUITES = [
  "backup", "corruption", "suki-store", "stock-history", "checkout", "measured-draft", "cart-draft", "expiry",
  "low-stock", "known-bugs",
];
const NODE_SUITES = ["static", "pages", "icons", "overlay", "known-bugs-login", "requests"];
// These change shared server state or depend on timing, so nothing runs beside them.
const RUN_ALONE = ["pages", "overlay", "requests"];
const REPORT_ORDER = [...BROWSER_SUITES, ...NODE_SUITES];
const KNOWN_SUITES = new Set(["known-bugs", "known-bugs-login"]);
const WORKERS = 4;
const STALL_MS = 150000;
const NODE_TEST_MS = 120000;
const CHROME_STALLED = /no reply from Chrome|Chrome connection closed|Stalled: no result/;

async function openSession() {
  const session = { chrome: null, restarts: 0, generation: 0, restarting: null, handlers: new Map() };
  session.server = createServer({ onResult: (result) => session.handlers.get(result.suite)?.(result) });
  await session.server.start();
  try {
    session.chrome = await launch();
  } catch (error) {
    await session.server.stop();
    throw error;
  }
  return session;
}

async function closeSession(session) {
  await session.chrome.close();
  await session.server.stop();
}

// Every suite that saw the same stall shares one restart.
function restartChrome(session, generation) {
  if (session.generation !== generation) return session.restarting;
  session.generation += 1;
  session.restarts += 1;
  process.stdout.write("R");
  session.restarting = (async () => {
    await session.chrome.close();
    session.chrome = await launch();
  })();
  return session.restarting;
}

async function runBrowserSuite(suite, only, session) {
  const results = [];
  const page = await Page.open(session.chrome.cdp, session.server);
  try {
    await new Promise((resolve, reject) => {
      let timer;
      const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => reject(new Error(`Stalled: no result for ${STALL_MS} ms`)), STALL_MS);
      };
      session.handlers.set(suite, (result) => {
        arm();
        if (result.done) {
          clearTimeout(timer);
          // A suite whose script failed to load has no tests, which must never look like a pass.
          if (result.loaded) resolve();
          else reject(new Error(`Stalled: no result, the ${suite} tests did not load`));
        } else {
          results.push({ ...result, known: KNOWN_SUITES.has(suite) });
          process.stdout.write(result.ok ? "." : "F");
        }
      });
      arm();
      const query = `suite=${suite}${only ? `&only=${encodeURIComponent(only)}` : ""}`;
      // Known bugs about dates need a fixed zone, whatever computer runs them.
      const zone = suite === "known-bugs"
        ? page.send("Emulation.setTimezoneOverride", { timezoneId: "Asia/Manila" })
        : Promise.resolve();
      zone.then(() => page.send("Page.navigate", { url: page.url(`__harness?${query}`) })).catch(reject);
    });
  } finally {
    session.handlers.delete(suite);
    await page.close();
  }
  return results;
}

async function runNodeTest({ suite, name, run }, session) {
  const { server } = session;
  const started = Date.now();
  let page = null;
  let reason = "";
  let timer;
  server.delays = [];
  server.hook = true;
  server.noStore = true;
  server.requests.length = 0;
  try {
    page = await Page.open(session.chrome.cdp, server);
    await Promise.race([
      run({ page, server }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${NODE_TEST_MS} ms`)), NODE_TEST_MS);
      }),
    ]);
  } catch (error) {
    reason = String(error.message || error);
  }
  clearTimeout(timer);
  if (page) await page.close();
  return { suite, name, ok: !reason, reason, ms: Date.now() - started, known: KNOWN_SUITES.has(suite) };
}

async function runNodeSuite(suite, only, session) {
  const { tests } = require(`../node/${suite}`);
  const filter = only ? new RegExp(only, "i") : null;
  const results = [];
  for (const { name, run } of tests) {
    if (filter && !filter.test(`${suite}: ${name}`)) continue;
    const generation = session.generation;
    let result = await runNodeTest({ suite, name, run }, session);
    if (CHROME_STALLED.test(result.reason)) {
      await restartChrome(session, generation);
      result = await runNodeTest({ suite, name, run }, session);
    }
    results.push(result);
    process.stdout.write(result.ok ? "." : "F");
  }
  return results;
}

async function runSuite(suite, only, session) {
  const run = () => (BROWSER_SUITES.includes(suite)
    ? runBrowserSuite(suite, only, session)
    : runNodeSuite(suite, only, session));
  const generation = session.generation;
  try {
    return await run();
  } catch (error) {
    if (CHROME_STALLED.test(error.message)) {
      await restartChrome(session, generation);
      try {
        return await run();
      } catch (retryError) {
        return [{ suite, name: "(suite)", ok: false, reason: retryError.message, known: KNOWN_SUITES.has(suite) }];
      }
    }
    return [{ suite, name: "(suite)", ok: false, reason: error.message, known: KNOWN_SUITES.has(suite) }];
  }
}

// Runs the chosen suites and returns their results in a fixed order.
async function runSuites(session, { only = "", mutation = null, suites = REPORT_ORDER } = {}) {
  session.server.setMutation(mutation);
  session.server.failed.clear();
  const bySuite = new Map();
  const queue = suites.filter((suite) => !RUN_ALONE.includes(suite));
  const worker = async () => {
    while (queue.length) {
      const suite = queue.shift();
      bySuite.set(suite, await runSuite(suite, only, session));
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));
  for (const suite of RUN_ALONE.filter((name) => suites.includes(name))) {
    bySuite.set(suite, await runSuite(suite, only, session));
  }
  return REPORT_ORDER.flatMap((suite) => bySuite.get(suite) || []);
}

module.exports = { openSession, closeSession, runSuites, REPORT_ORDER };
