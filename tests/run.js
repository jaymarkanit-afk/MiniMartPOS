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
const { openSession, closeSession, runSuites } = require("./lib/runner");
const { mutations, trialFixes } = require("./mutations");

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

function printTable(results, restarts, seconds) {
  const main = results.filter((result) => !result.known);
  const known = results.filter((result) => result.known);
  printRows(main, "PASS", "FAIL");
  const failed = main.filter((result) => !result.ok).length;
  console.log(`\n${main.length} tests, ${main.length - failed} passed, ${failed} failed, in ${seconds} seconds.`);
  if (known.length) {
    console.log("\nKNOWN BUGS (reported, not fixed, and not counted in the result above)\n");
    printRows(known, "NOW PASSES", "STILL FAILS");
    const open = known.filter((result) => !result.ok).length;
    console.log(`\nKNOWN BUGS: ${known.length} tests, ${open} still fail, ${known.length - open} now pass.`);
  }
  if (restarts) console.log(`\nChrome stopped responding ${restarts} time(s). It was restarted and the affected tests were rerun.`);
}

async function main() {
  const only = option("only");
  const mutateId = option("mutate");
  const jsonPath = option("json");
  const mutation = mutateId ? [...mutations, ...trialFixes].find(({ id }) => id === mutateId) : null;
  if (mutateId && !mutation) throw new Error(`Unknown mutation: ${mutateId}`);

  const started = Date.now();
  const session = await openSession();
  let results = [];
  try {
    // Anything unexpected still reaches the finally below, so Chrome and its profile go.
    results = await new Promise((resolve, reject) => {
      process.once("unhandledRejection", reject);
      runSuites(session, { only, mutation }).then(resolve, reject);
    });
  } finally {
    await closeSession(session);
  }
  process.stdout.write("\n\n");
  printTable(results, session.restarts, Math.round((Date.now() - started) / 1000));
  if (jsonPath) fs.writeFileSync(path.resolve(jsonPath), JSON.stringify(results, null, 1));
  if (!results.length) throw new Error("No tests ran.");
  return results.every((result) => result.ok || result.known) ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\nThe run did not finish: ${error.message}`);
    process.exit(2);
  },
);
