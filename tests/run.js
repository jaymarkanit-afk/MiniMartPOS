#!/usr/bin/env node
"use strict";
// Runs the whole suite: node tests/run.js
// Options: --only=<regex>   run matching "suite: test" names
//          --mutate=<id>    run with one mutation from mutations.js applied in memory
//          --json=<file>    also write the results as JSON
const fs = require("fs");
const path = require("path");
const { launch } = require("./lib/chrome");
const { createServer } = require("./lib/server");
const { Page } = require("./lib/cdp");
const { mutations } = require("./mutations");

const BROWSER_SUITES = [
  "backup", "corruption", "suki-store", "stock-history", "checkout", "measured-draft", "cart-draft", "expiry",
];
const NODE_SUITES = ["static", "pages", "icons", "overlay", "requests"];
const STALL_MS = 150000;
const NODE_TEST_MS = 120000;

const option = (name) => {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

function printTable(results) {
  const nameWidth = Math.max(4, ...results.map((result) => `${result.suite}: ${result.name}`.length));
  const row = (name, status, reason) => `${name.padEnd(nameWidth)}  ${status.padEnd(6)}  ${reason}`.trimEnd();
  console.log(row("Test", "Result", "Reason"));
  console.log(`${"-".repeat(nameWidth)}  ------  ------`);
  results.forEach((result) => {
    console.log(row(`${result.suite}: ${result.name}`, result.ok ? "PASS" : "FAIL", result.reason));
  });
  const failed = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length} tests, ${results.length - failed} passed, ${failed} failed.`);
}

async function runBrowserSuite(suite, only, chrome, server, session) {
  const page = await Page.open(chrome.cdp, server);
  await new Promise((resolve) => {
    let timer;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        session.results.push({ suite, name: "(suite)", ok: false, reason: `Stalled: no result for ${STALL_MS} ms` });
        resolve();
      }, STALL_MS);
    };
    session.onResult = (result) => {
      arm();
      if (result.done) {
        clearTimeout(timer);
        resolve();
      } else {
        session.results.push(result);
        process.stdout.write(result.ok ? "." : "F");
      }
    };
    arm();
    const query = `suite=${suite}${only ? `&only=${encodeURIComponent(only)}` : ""}`;
    page.send("Page.navigate", { url: page.url(`__harness?${query}`) });
  });
  await page.close();
}

async function runNodeSuite(suite, only, chrome, server, session) {
  const { tests } = require(`./node/${suite}`);
  const filter = only ? new RegExp(only, "i") : null;
  for (const { name, run } of tests) {
    if (filter && !filter.test(`${suite}: ${name}`)) continue;
    const started = Date.now();
    let page = null;
    let reason = "";
    server.delays = [];
    server.hook = true;
    server.noStore = true;
    server.requests.length = 0;
    let timer;
    try {
      page = await Page.open(chrome.cdp, server);
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
    session.results.push({ suite, name, ok: !reason, reason, ms: Date.now() - started });
    process.stdout.write(reason ? "F" : ".");
  }
}

async function main() {
  const only = option("only");
  const mutateId = option("mutate");
  const jsonPath = option("json");
  const mutation = mutateId ? mutations.find(({ id }) => id === mutateId) : null;
  if (mutateId && !mutation) throw new Error(`Unknown mutation: ${mutateId}`);

  const session = { results: [], onResult: () => {} };
  const server = createServer({ mutation, onResult: (result) => session.onResult(result) });
  await server.start();
  let chrome;
  try {
    chrome = await launch();
    // Anything unexpected still reaches the finally below, so Chrome and its profile go.
    await new Promise((resolve, reject) => {
      process.once("unhandledRejection", reject);
      (async () => {
        for (const suite of BROWSER_SUITES) await runBrowserSuite(suite, only, chrome, server, session);
        for (const suite of NODE_SUITES) await runNodeSuite(suite, only, chrome, server, session);
      })().then(resolve, reject);
    });
  } finally {
    if (chrome) await chrome.close();
    await server.stop();
  }
  process.stdout.write("\n\n");
  printTable(session.results);
  if (jsonPath) fs.writeFileSync(path.resolve(jsonPath), JSON.stringify(session.results, null, 1));
  if (!session.results.length) throw new Error("No tests ran.");
  return session.results.every((result) => result.ok) ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error.message);
    process.exit(2);
  },
);
