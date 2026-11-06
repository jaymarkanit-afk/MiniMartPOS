#!/usr/bin/env node
"use strict";
// Runs the whole suite: node tests/run.js
// Options: --only=<regex>   run matching "suite: test" names
//          --mutate=<id>    run with one mutation from mutations.js applied in memory
//          --json=<file>    also write the results as JSON
// Exit code: 0 all main tests pass, 1 a main test failed, 2 the run could not finish.
// KNOWN BUGS tests are reported in their own section and never affect the exit code.
const fs = require("fs");
const path = require("path");
const { launch } = require("./lib/chrome");
const { createServer } = require("./lib/server");
const { Page } = require("./lib/cdp");
const { mutations, trialFixes } = require("./mutations");

const BROWSER_SUITES = [
  "backup", "corruption", "suki-store", "stock-history", "checkout", "measured-draft", "cart-draft", "expiry",
  "known-bugs",
];
const NODE_SUITES = ["static", "pages", "icons", "overlay", "known-bugs-login", "requests"];
const KNOWN_SUITES = new Set(["known-bugs", "known-bugs-login"]);
const STALL_MS = 150000;
const NODE_TEST_MS = 120000;
const CHROME_STALLED = /no reply from Chrome|Chrome connection closed|Stalled: no result/;

const option = (name) => {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

function printRows(results, passed, failed) {
  const nameWidth = Math.max(4, ...results.map((result) => `${result.suite}: ${result.name}`.length));
  const statusWidth = Math.max(6, passed.length, failed.length);
  const row = (name, status, reason) => `${name.padEnd(nameWidth)}  ${status.padEnd(statusWidth)}  ${reason}`.trimEnd();
  console.log(row("Test", "Result", "Reason"));
  console.log(`${"-".repeat(nameWidth)}  ${"-".repeat(statusWidth)}  ------`);
  results.forEach((result) => {
    console.log(row(`${result.suite}: ${result.name}`, result.ok ? passed : failed, result.reason));
  });
}

function printTable(results, restarts) {
  const main = results.filter((result) => !result.known);
  const known = results.filter((result) => result.known);
  printRows(main, "PASS", "FAIL");
  const failed = main.filter((result) => !result.ok).length;
  console.log(`\n${main.length} tests, ${main.length - failed} passed, ${failed} failed.`);
  if (known.length) {
    console.log("\nKNOWN BUGS (reported, not fixed, and not counted in the result above)\n");
    printRows(known, "NOW PASSES", "STILL FAILS");
    const open = known.filter((result) => !result.ok).length;
    console.log(`\nKNOWN BUGS: ${known.length} tests, ${open} still fail, ${known.length - open} now pass.`);
  }
  if (restarts) console.log(`\nChrome stopped responding ${restarts} time(s). It was restarted and the affected tests were rerun.`);
}

async function runBrowserSuite(suite, only, session, server) {
  const page = await Page.open(session.chrome.cdp, server);
  await new Promise((resolve, reject) => {
    let timer;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => reject(new Error(`Stalled: no result for ${STALL_MS} ms`)), STALL_MS);
    };
    session.onResult = (result) => {
      arm();
      if (result.done) {
        clearTimeout(timer);
        resolve();
      } else {
        session.results.push({ ...result, known: KNOWN_SUITES.has(suite) });
        process.stdout.write(result.ok ? "." : "F");
      }
    };
    arm();
    const query = `suite=${suite}${only ? `&only=${encodeURIComponent(only)}` : ""}`;
    // Known bugs about dates need a fixed zone, whatever computer runs them.
    const zone = suite === "known-bugs"
      ? page.send("Emulation.setTimezoneOverride", { timezoneId: "Asia/Manila" })
      : Promise.resolve();
    zone.then(() => page.send("Page.navigate", { url: page.url(`__harness?${query}`) })).catch(reject);
  });
  await page.close();
}

async function runNodeTest({ suite, name, run }, session, server) {
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

async function restartChrome(session) {
  session.restarts += 1;
  process.stdout.write("R");
  await session.chrome.close();
  session.chrome = await launch();
}

async function runAll(only, session, server) {
  for (const suite of BROWSER_SUITES) {
    const start = session.results.length;
    try {
      await runBrowserSuite(suite, only, session, server);
    } catch (error) {
      if (!CHROME_STALLED.test(error.message)) throw error;
      session.results.length = start;
      await restartChrome(session);
      await runBrowserSuite(suite, only, session, server);
    }
  }
  for (const suite of NODE_SUITES) {
    const { tests } = require(`./node/${suite}`);
    const filter = only ? new RegExp(only, "i") : null;
    for (const { name, run } of tests) {
      if (filter && !filter.test(`${suite}: ${name}`)) continue;
      let result = await runNodeTest({ suite, name, run }, session, server);
      if (CHROME_STALLED.test(result.reason)) {
        await restartChrome(session);
        result = await runNodeTest({ suite, name, run }, session, server);
      }
      session.results.push(result);
      process.stdout.write(result.ok ? "." : "F");
    }
  }
}

async function main() {
  const only = option("only");
  const mutateId = option("mutate");
  const jsonPath = option("json");
  const mutation = mutateId ? [...mutations, ...trialFixes].find(({ id }) => id === mutateId) : null;
  if (mutateId && !mutation) throw new Error(`Unknown mutation: ${mutateId}`);

  const session = { results: [], restarts: 0, chrome: null, onResult: () => {} };
  const server = createServer({ mutation, onResult: (result) => session.onResult(result) });
  await server.start();
  let crash = null;
  try {
    session.chrome = await launch();
    // Anything unexpected still reaches the finally below, so Chrome and its profile go.
    await new Promise((resolve, reject) => {
      process.once("unhandledRejection", reject);
      runAll(only, session, server).then(resolve, reject);
    });
  } catch (error) {
    crash = error;
  } finally {
    if (session.chrome) await session.chrome.close();
    await server.stop();
  }
  process.stdout.write("\n\n");
  printTable(session.results, session.restarts);
  if (jsonPath) fs.writeFileSync(path.resolve(jsonPath), JSON.stringify(session.results, null, 1));
  if (crash) throw crash;
  if (!session.results.length) throw new Error("No tests ran.");
  return session.results.every((result) => result.ok || result.known) ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\nThe run did not finish: ${error.message}`);
    process.exit(2);
  },
);
