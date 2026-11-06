"use strict";
// Runs last. A browser asks for some files once per run, such as the favicon, so a
// check on one page would depend on test order. This checks the whole run instead.
const tests = [
  {
    name: "no app request failed at any point in the run",
    run: async ({ server }) => {
      const failed = [...server.failed];
      if (failed.length) throw new Error(`Failed requests: ${failed.join(", ")}`);
    },
  },
];

module.exports = { tests };
