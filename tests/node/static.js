"use strict";
// Source checks per page: undefined functions, fatal redeclarations and missing elements.
// All scripts on a page share one global scope, so these only show up at run time.
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../lib/server");

const PAGES = ["index", "inventory", "reports", "settings", "suki-reward", "login"];
const BUILTIN = new Set("if for while switch catch function return typeof await async super new void delete in of Number String Boolean Array Object Map Set Date Math JSON Error Promise RegExp Blob URL URLSearchParams Symbol parseInt parseFloat isNaN isFinite setTimeout clearTimeout setInterval clearInterval alert confirm prompt fetch CustomEvent Event FileReader NDEFReader Intl BigInt var".split(" "));
let server = null;
const read = (file) => (server ? server.source(file) : fs.readFileSync(path.join(ROOT, file), "utf8"));
const strip = (code) => code
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
  .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
  .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
const scriptsOf = (html) => [...html.matchAll(/<script src="(js\/(?!vendor)[^"]+)"/g)].map((match) => match[1]);

function definedNames(code) {
  const names = new Set();
  const add = (value) => names.add(value.replace(/=.*/, "").trim());
  for (const m of code.matchAll(/\bfunction\s+([\w$]+)/g)) add(m[1]);
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([\w$]+)/g)) add(m[1]);
  for (const m of code.matchAll(/\b(?:const|let|var)\s+\{([^}]*)\}/g)) m[1].split(",").forEach((part) => add(part.split(":").pop()));
  for (const m of code.matchAll(/\b(?:const|let|var)\s+\[([^\]]*)\]/g)) m[1].split(",").forEach(add);
  for (const m of code.matchAll(/window\.([\w$]+)\s*=/g)) add(m[1]);
  for (const m of code.matchAll(/^\s*(?:async\s+)?([\w$]+)\s*\([^)]*\)\s*\{/gm)) add(m[1]);
  for (const m of code.matchAll(/\(([^()]*)\)\s*=>|\bfunction\s*[\w$]*\(([^()]*)\)/g)) (m[1] ?? m[2]).split(",").forEach(add);
  for (const m of code.matchAll(/\b([\w$]+)\s*=>/g)) add(m[1]);
  return names;
}

function undefinedCalls(page) {
  const sources = scriptsOf(read(`${page}.html`)).map((file) => [file, strip(read(file))]);
  const defined = new Set();
  sources.forEach(([, code]) => definedNames(code).forEach((name) => defined.add(name)));
  const missing = new Set();
  for (const [file, code] of sources) {
    for (const match of code.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/gm)) {
      const name = match[2];
      if (BUILTIN.has(name) || defined.has(name)) continue;
      if (/`[^`]*$/.test(code.slice(Math.max(0, match.index - 40), match.index))) continue;
      missing.add(`${name} (${file})`);
    }
  }
  return [...missing];
}

function redeclarations(page) {
  const declared = new Map();
  for (const file of scriptsOf(read(`${page}.html`))) {
    for (const match of read(file).matchAll(/^(const|let|class|function|async function)\s+([A-Za-z_$][\w$]*)/gm)) {
      const list = declared.get(match[2]) || [];
      list.push({ file, kind: match[1] });
      declared.set(match[2], list);
    }
  }
  return [...declared]
    .filter(([, list]) => list.length > 1 && list.some(({ kind }) => /const|let|class/.test(kind)))
    .map(([name, list]) => `${name}: ${list.map(({ file }) => file).join(", ")}`);
}

function missingElements(page) {
  const html = read(`${page}.html`);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const missing = new Set();
  for (const file of scriptsOf(html)) {
    const code = read(file);
    for (const match of code.matchAll(/^const \w+ = document\.getElementById\("([^"]+)"\);$/gm)) {
      if (!ids.has(match[1]) && !code.includes(`id="${match[1]}"`)) missing.add(`${match[1]} (${file})`);
    }
  }
  return [...missing];
}

const expectNone = (list, label) => {
  if (list.length) throw new Error(`${label}: ${list.join("; ")}`);
};

const tests = [];
for (const page of PAGES) {
  tests.push({ name: `${page}: no undefined functions`, run: async () => expectNone(undefinedCalls(page), "Undefined") });
  tests.push({ name: `${page}: no fatal redeclarations`, run: async () => expectNone(redeclarations(page), "Redeclared") });
}
// Only checkout, inventory and the like fetch required elements at the top of a script.
for (const page of ["index", "inventory", "reports", "settings", "suki-reward"]) {
  tests.push({ name: `${page}: every required element exists`, run: async () => expectNone(missingElements(page), "Missing") });
}

// These share a name across files on purpose. Each pair never loads on the same page,
// and they do different jobs, so a shared copy would be wrong. Anything else is a duplicate.
const ALLOWED_DUPLICATES = {
  search: "Each page's own search box",
  selectedSukiId: "Each page's own selection state",
  sukiStore: "Each page's short name for window.miniMartSukiStore",
  sukiRules: "Each page's short name for window.miniMartSukiRules",
  stockHistoryNotice: "Each page's own element",
  updateStockHistoryNotice: "Inventory's notice has a span and Settings' does not",
  validateForm: "Different forms",
  openModal: "Different modals",
  closeModal: "Different modals",
  fields: "Different forms",
};

function definitionsByName() {
  const names = new Map();
  for (const file of fs.readdirSync(path.join(ROOT, "js")).filter((name) => name.endsWith(".js"))) {
    for (const match of read(`js/${file}`).matchAll(/^(?:const|let|class|function|async function)\s+([A-Za-z_$][\w$]*)/gm)) {
      names.set(match[1], (names.get(match[1]) || new Set()).add(file));
    }
  }
  return [...names].filter(([, files]) => files.size > 1);
}

function functionBody(file, name) {
  return read(`js/${file}`).match(new RegExp(`^function ${name}\\([\\s\\S]*?^}`, "m"))?.[0] ?? null;
}

tests.push({
  name: "js: no helper is defined in two files",
  run: async () => expectNone(
    definitionsByName()
      .filter(([name]) => !ALLOWED_DUPLICATES[name])
      .map(([name, files]) => `${name} (${[...files].join(", ")})`),
    "Duplicate",
  ),
});

tests.push({
  name: "js: every allowed duplicate still exists and really differs",
  run: async () => {
    const found = new Map(definitionsByName());
    expectNone(Object.keys(ALLOWED_DUPLICATES).filter((name) => !found.has(name)), "No longer duplicated, remove from the list");
    const identical = [...found].filter(([name, files]) => {
      const bodies = [...files].map((file) => functionBody(file, name));
      return ALLOWED_DUPLICATES[name] && bodies.every(Boolean) && new Set(bodies.map((body) => body.replace(/\s+/g, " "))).size === 1;
    });
    expectNone(identical.map(([name]) => name), "Identical copies");
  },
});

tests.push({
  name: "js: lowStockThreshold is only the Settings input",
  run: async () => {
    const found = fs.readdirSync(path.join(ROOT, "js"))
      .filter((name) => name.endsWith(".js"))
      .filter((name) => /^(?:const|let|function)\s+lowStockThreshold\b/m.test(read(`js/${name}`)));
    expectNone(found.filter((name) => name !== "settings-core.js"), "Defined in");
  },
});

module.exports = {
  tests: tests.map((entry) => ({
    ...entry,
    run: (context) => {
      ({ server } = context);
      return entry.run(context);
    },
  })),
};
