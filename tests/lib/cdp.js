"use strict";
// Minimal WebSocket client and Chrome DevTools Protocol wrapper. Node 18 has no
// built-in WebSocket client and this suite takes no npm dependencies.
const http = require("http");
const crypto = require("crypto");

const COMMAND_TIMEOUT_MS = 30000;

function openSocket(url) {
  const { hostname, port, pathname } = new URL(url);
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname,
      port,
      path: pathname,
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": crypto.randomBytes(16).toString("base64"),
      },
    });
    request.on("upgrade", (response, socket) => resolve(socket));
    request.on("response", (response) => reject(new Error(`WebSocket refused: ${response.statusCode}`)));
    request.on("error", reject);
    request.end();
  });
}

function encodeFrame(text) {
  const payload = Buffer.from(text);
  const mask = crypto.randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, 0x80 | payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  const masked = Buffer.from(payload);
  for (let index = 0; index < masked.length; index += 1) masked[index] ^= mask[index % 4];
  return Buffer.concat([header, mask, masked]);
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    socket.on("data", (chunk) => this.receive(chunk));
    socket.on("error", () => {});
    socket.on("close", () => {
      this.pending.forEach(({ reject }) => reject(new Error("Chrome connection closed")));
      this.pending.clear();
    });
  }

  static async connect(url) {
    return new Cdp(await openSocket(url));
  }

  receive(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      if (this.buffer.length < 2) return;
      const opcode = this.buffer[0] & 0x0f;
      const final = Boolean(this.buffer[0] & 0x80);
      let length = this.buffer[1] & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        length = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }
      if (this.buffer.length < offset + length) return;
      const payload = this.buffer.subarray(offset, offset + length);
      this.buffer = this.buffer.subarray(offset + length);
      if (opcode === 0 || opcode === 1) {
        this.fragments.push(Buffer.from(payload));
        if (final) {
          const message = Buffer.concat(this.fragments).toString();
          this.fragments = [];
          this.dispatch(JSON.parse(message));
        }
      }
    }
  }

  dispatch(message) {
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject, method } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(`${method}: ${message.error.message}`));
      else resolve(message.result);
      return;
    }
    this.listeners.forEach((listener) => listener(message));
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method}: no reply from Chrome after ${COMMAND_TIMEOUT_MS} ms`));
      }, COMMAND_TIMEOUT_MS);
      this.pending.set(id, {
        method,
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.socket.write(encodeFrame(JSON.stringify({ id, method, params, sessionId })));
    });
  }

  close() {
    this.socket.destroy();
  }
}

const SESSION = JSON.stringify({
  user: { id: "x", email: "admin@gmail.com", email_confirmed_at: "2026-01-01T00:00:00.000Z", user_metadata: {} },
  access_token: "t",
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One tab in its own throwaway browser context, so each test starts with empty storage.
class Page {
  constructor(cdp, sessionId, contextId, server) {
    this.cdp = cdp;
    this.sessionId = sessionId;
    this.contextId = contextId;
    this.server = server;
    this.waiters = new Set();
    this.problems = [];
    this.requests = new Map();
    this.listener = (message) => {
      if (message.sessionId === sessionId) this.onEvent(message);
    };
    cdp.listeners.add(this.listener);
  }

  static async open(cdp, server) {
    const { browserContextId } = await cdp.send("Target.createBrowserContext");
    const { targetId } = await cdp.send("Target.createTarget", {
      url: "about:blank",
      browserContextId,
      width: 1280,
      height: 900,
    });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(cdp, sessionId, browserContextId, server);
    await cdp.send("Browser.setDownloadBehavior", { behavior: "deny", browserContextId });
    await Promise.all(
      ["Page.enable", "Runtime.enable", "Log.enable", "Network.enable"].map((method) => page.send(method)),
    );
    await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    return page;
  }

  send(method, params) {
    return this.cdp.send(method, params, this.sessionId);
  }

  onEvent({ method, params }) {
    if (method === "Page.javascriptDialogOpening") {
      this.send("Page.handleJavaScriptDialog", { accept: params.type === "beforeunload" }).catch(() => {});
    } else if (method === "Runtime.exceptionThrown") {
      const details = params.exceptionDetails;
      this.problems.push({ kind: "exception", text: details.exception?.description || details.text });
    } else if (method === "Runtime.consoleAPICalled" && params.type === "error") {
      const text = params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ");
      this.problems.push({ kind: "console.error", text, url: params.stackTrace?.callFrames?.[0]?.url });
    } else if (method === "Log.entryAdded" && params.entry.level === "error") {
      this.problems.push({ kind: "log", text: params.entry.text, url: params.entry.url });
    } else if (method === "Network.requestWillBeSent") {
      this.requests.set(params.requestId, params.request.url);
    } else if (method === "Network.responseReceived" && params.response.status >= 400) {
      this.problems.push({ kind: "http", text: `${params.response.status} ${params.response.url}`, url: params.response.url });
    } else if (method === "Network.loadingFailed" && !params.canceled) {
      const url = this.requests.get(params.requestId);
      this.problems.push({ kind: "network", text: `${params.errorText} ${url}`, url });
    }
    this.waiters.forEach((waiter) => waiter(method, params));
  }

  waitEvent(name, timeout = 15000) {
    const waiting = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(new Error(`Timed out waiting for ${name}`));
      }, timeout);
      const waiter = (method, params) => {
        if (method !== name) return;
        clearTimeout(timer);
        this.waiters.delete(waiter);
        resolve(params);
      };
      this.waiters.add(waiter);
    });
    // A test may fail before it awaits this, and that must not crash the whole run.
    waiting.catch(() => {});
    return waiting;
  }

  url(path) {
    return `http://127.0.0.1:${this.server.port}/${path}`;
  }

  async goto(path, settle = 350) {
    const loaded = this.waitEvent("Page.loadEventFired");
    await this.send("Page.navigate", { url: this.url(path) });
    await loaded;
    await sleep(settle);
  }

  // Seeds storage before the first real page load, signed in by default.
  async seed(storage = {}, { signedIn = true } = {}) {
    await this.goto("__blank", 0);
    await this.eval((items, session) => {
      localStorage.clear();
      if (session) localStorage.setItem("miniMartLocalDemoSession", session);
      Object.entries(items).forEach(([key, value]) => {
        localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      });
    }, storage, signedIn ? SESSION : null);
  }

  async eval(expression, ...args) {
    const source = typeof expression === "function"
      ? `(${expression})(...${JSON.stringify(args)})`
      : expression;
    const { result, exceptionDetails } = await this.send("Runtime.evaluate", {
      expression: source,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    }
    return result.value;
  }

  async until(expression, { timeout = 5000, label = "condition" } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await this.eval(expression).catch(() => false)) return Date.now() - start;
      await sleep(25);
    }
    throw new Error(`Timed out waiting for ${label}`);
  }

  async centerOf(selector, index = 0) {
    const point = await this.eval((target, position) => {
      const element = document.querySelectorAll(target)[position];
      if (!element) return null;
      element.scrollIntoView({ block: "center", behavior: "instant" });
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, selector, index);
    if (!point) throw new Error(`No element for ${selector}[${index}]`);
    return point;
  }

  async hover(selector, index = 0) {
    const { x, y } = await this.centerOf(selector, index);
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  }

  async moveAway() {
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
  }

  async click(selector, index = 0) {
    const { x, y } = await this.centerOf(selector, index);
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }

  async pressTab() {
    const key = { key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 };
    await this.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...key });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
  }

  async pressKey(key, { shift = false } = {}) {
    const codes = { Enter: 13, Escape: 27, Tab: 9 };
    const event = {
      key,
      code: key,
      windowsVirtualKeyCode: codes[key],
      nativeVirtualKeyCode: codes[key],
      modifiers: shift ? 8 : 0,
    };
    await this.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...event });
    if (key === "Enter") await this.send("Input.dispatchKeyEvent", { type: "char", ...event, text: "\r" });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", ...event });
  }

  async goBack() {
    const { currentIndex, entries } = await this.send("Page.getNavigationHistory");
    await this.send("Page.navigateToHistoryEntry", { entryId: entries[currentIndex - 1].id });
  }

  async close() {
    this.cdp.listeners.delete(this.listener);
    await this.cdp.send("Target.disposeBrowserContext", { browserContextId: this.contextId }).catch(() => {});
  }
}

module.exports = { Cdp, Page, sleep };
