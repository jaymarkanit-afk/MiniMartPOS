#!/usr/bin/env node
"use strict";
// Proves the tests mean something. No file on disk changes at any point.
//   node tests/mutate.js               Reverts each fix in memory. Its tests must fail.
//   node tests/mutate.js --known       Fixes each known bug in memory. Its tests must pass.
//   node tests/mutate.js --id=<a,b>    Runs only the named entries from either list.
// One Chrome is shared, and each check opens only the suites its tests are in.
const { openSession, closeSession, runSuites } = require("./lib/runner");
const { mutations, trialFixes } = require("./mutations");

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function runTests(session, names, mutation = null) {
  const only = `^(${names.map(escapeRegex).join("|")})$`;
  const suites = [...new Set(names.map((name) => name.split(": ")[0]))];
  const results = await runSuites(session, { only, mutation, suites });
  return names.map((name) => {
    const result = results.find(({ suite, name: testName }) => `${suite}: ${testName}` === name);
    if (!result) throw new Error(`Test did not run: ${name}`);
    return { name, ok: result.ok, reason: result.reason };
  });
}

async function checkKnownBugs(session, chosen) {
  let wrong = 0;
  for (const fix of chosen) {
    const before = await runTests(session, fix.tests);
    const after = await runTests(session, fix.tests, fix);
    console.log(`\n${fix.id}`);
    fix.tests.forEach((name, index) => {
      const valid = !before[index].ok && after[index].ok;
      if (!valid) wrong += 1;
      console.log(`  ${valid ? "VALID  " : "INVALID"} ${name}`);
      console.log(`          today: ${before[index].ok ? "passes" : before[index].reason.slice(0, 150)}`);
      if (!after[index].ok) console.log(`          with trial fix: ${after[index].reason.slice(0, 150)}`);
    });
  }
  console.log(`\n${chosen.length} trial fixes, ${wrong} tests did not go from failing to passing.`);
  return wrong ? 1 : 0;
}

async function checkMutations(session, chosen) {
  const allTests = [...new Set(chosen.flatMap(({ tests }) => tests))];
  console.log(`Baseline: ${allTests.length} tests on the real code`);
  const broken = (await runTests(session, allTests)).filter(({ ok }) => !ok);
  if (broken.length) {
    broken.forEach(({ name, reason }) => console.log(`  FAILS BEFORE ANY MUTATION: ${name}: ${reason}`));
    return 2;
  }
  console.log("\nAll pass.");
  let missed = 0;
  for (const mutation of chosen) {
    const results = await runTests(session, mutation.tests, mutation);
    console.log(`\n${mutation.id}: ${mutation.fix}`);
    results.forEach(({ name, ok, reason }) => {
      if (ok) missed += 1;
      console.log(`  ${ok ? "NOT CAUGHT" : "CAUGHT    "} ${name}`);
      if (!ok) console.log(`             ${reason.slice(0, 200)}`);
    });
  }
  console.log(`\n${chosen.length} mutations, ${missed} tests failed to catch theirs.`);
  return missed ? 1 : 0;
}

async function main() {
  const args = process.argv.slice(2);
  const ids = args.find((arg) => arg.startsWith("--id="))?.slice(5).split(",");
  const known = args.includes("--known") || Boolean(ids?.some((id) => trialFixes.some((fix) => fix.id === id)));
  const list = known ? trialFixes : mutations;
  const chosen = ids ? list.filter(({ id }) => ids.includes(id)) : list;
  if (!chosen.length || (ids && chosen.length !== ids.length)) {
    console.error(`Unknown mutation in: ${ids}`);
    return 2;
  }
  const session = await openSession();
  try {
    return await (known ? checkKnownBugs(session, chosen) : checkMutations(session, chosen));
  } finally {
    await closeSession(session);
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`\nThe run did not finish: ${error.message}`);
    process.exit(2);
  },
);
