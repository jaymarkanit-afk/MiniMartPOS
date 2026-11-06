"use strict";
// Serves the app to Chrome. It can delay responses, and it can apply a mutation in
// memory: mutation runs never change a file on disk, so a crash cannot leave one behind.
const fs = require("fs");
const http = require("http");
const path = require("path");

const TESTS = path.resolve(__dirname, "..");
const ROOT = path.resolve(TESTS, "..");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
// Lets the harness instrument each page before any app script runs.
const HOOK = "<script>try{if(parent!==window&&parent.__hook)parent.__hook(window)}catch(error){}</script>";

function checkMutation(mutation) {
  mutation.edits.forEach(({ file, from }) => {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");
    const count = text.split(from).length - 1;
    if (count !== 1) throw new Error(`Mutation "${mutation.id}": expected 1 match in ${file}, found ${count}: ${from}`);
  });
}

function applyMutation(mutation, file, buffer) {
  const edits = (mutation?.edits || []).filter((edit) => path.join(ROOT, edit.file) === file);
  if (!edits.length) return buffer;
  return edits.reduce(
    (text, { from, to }) => text.replace(from, () => to),
    buffer.toString("utf8").replace(/\r\n/g, "\n"),
  );
}

function createServer({ mutation = null, onResult = () => {} } = {}) {
  if (mutation) checkMutation(mutation);
  const state = { port: 0, requests: [], failed: new Set(), delays: [], hook: true, noStore: true };

  const send = async (response, url, status, type, body) => {
    state.requests.push({ url, status });
    if (status >= 400) state.failed.add(`${status} ${url}`);
    const delay = state.delays.find(({ match }) => match.test(url));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay.ms));
    response.statusCode = status;
    if (type) response.setHeader("Content-Type", type);
    if (state.noStore) response.setHeader("Cache-Control", "no-store");
    response.end(body);
  };

  const server = http.createServer((request, response) => {
    const url = decodeURIComponent(request.url.split("?")[0]);
    if (url === "/__result") {
      let body = "";
      request.on("data", (chunk) => { body += chunk; });
      request.on("end", () => {
        onResult(JSON.parse(body));
        response.end();
      });
      return;
    }
    if (url === "/__blank") return send(response, url, 200, TYPES[".html"], "<!doctype html><title>blank</title>");
    if (url === "/__harness") {
      const suite = new URL(request.url, "http://x").searchParams.get("suite");
      const page = `<!doctype html><title>${suite}</title><body></body>` +
        `<script src="/__tests/lib/harness.js"></script>` +
        `<script src="/__tests/browser/${suite}.js"></script>` +
        `<script>runSuite()</script>`;
      return send(response, url, 200, TYPES[".html"], page);
    }
    const inTests = url.startsWith("/__tests/");
    const base = inTests ? TESTS : ROOT;
    const file = path.join(base, inTests ? url.slice("/__tests/".length) : url === "/" ? "index.html" : url);
    if (!file.startsWith(base)) return send(response, url, 403);
    fs.readFile(file, (error, data) => {
      if (error) return send(response, url, 404);
      let body = applyMutation(mutation, file, data);
      if (file.endsWith(".html") && !inTests && state.hook) {
        body = String(body).replace("<head>", `<head>${HOOK}`);
      }
      send(response, url, 200, TYPES[path.extname(file)] || "application/octet-stream", body);
    });
  });

  state.start = () => new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      state.port = server.address().port;
      resolve();
    });
  });
  state.stop = () => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  });
  return state;
}

module.exports = { createServer, ROOT, TESTS };
