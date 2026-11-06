#!/usr/bin/env node
"use strict";
// Proves the important tests can fail: node tests/mutate.js
// Each mutation reverts one fix in memory. No file on disk changes at any point.
// Add --id=<mutation id> to run just one.
const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { mutations } = require("./mutations");

const RUN = path.join(__dirname, "run.js");
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function runTests(names, mutationId) {
  const output = path.join(os.tmpdir(), `minimart-mutation-${process.pid}.json`);
  const only = `^(${names.map(escapeRegex).join("|")})$`;
  const args = [RUN, `--only=${only}`, `--json=${output}`];
  if (mutationId) args.push(`--mutate=${mutationId}`);
  const run = cp.spawnSync(process.execPath, args, { encoding: "utf8", timeout: 400000 });
  if (!fs.existsSync(output)) {
    throw new Error(`Run did not finish: ${(run.stderr || run.stdout).slice(0, 300)}`);
  }
  const results = JSON.parse(fs.readFileSync(output, "utf8"));
  fs.rmSync(output);
  return names.map((name) => {
    const result = results.find(({ suite, name: testName }) => `${suite}: ${testName}` === name);
    if (!result) throw new Error(`Test did not run: ${name}`);
    return { name, ok: result.ok, reason: result.reason };
  });
}

const onlyId = process.argv.slice(2).find((arg) => arg.startsWith("--id="))?.slice(5);
const chosen = onlyId ? mutations.filter(({ id }) => id === onlyId) : mutations;
if (!chosen.length) {
  console.error(`Unknown mutation: ${onlyId}`);
  process.exit(2);
}
const allTests = [...new Set(chosen.flatMap(({ tests }) => tests))];

console.log(`Baseline: ${allTests.length} tests on the real code`);
const baseline = runTests(allTests);
const broken = baseline.filter(({ ok }) => !ok);
if (broken.length) {
  broken.forEach(({ name, reason }) => console.log(`  FAILS BEFORE ANY MUTATION: ${name}: ${reason}`));
  process.exit(2);
}
console.log("All pass.\n");

let missed = 0;
for (const mutation of chosen) {
  const results = runTests(mutation.tests, mutation.id);
  console.log(`${mutation.id}: ${mutation.fix}`);
  results.forEach(({ name, ok, reason }) => {
    if (ok) missed += 1;
    console.log(`  ${ok ? "NOT CAUGHT" : "CAUGHT    "} ${name}`);
    if (!ok) console.log(`             ${reason.slice(0, 200)}`);
  });
}
console.log(`\n${chosen.length} mutations, ${missed} tests failed to catch theirs.`);
process.exit(missed ? 1 : 0);
