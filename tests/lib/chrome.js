"use strict";
// Starts the installed Chrome headless with a throwaway profile, never the real one.
const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Cdp, sleep } = require("./cdp");

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

// External hosts are unreachable on purpose, so a test can never call the internet.
const BLOCKED_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

async function launch() {
  const binary = CANDIDATES.find((candidate) => candidate && fs.existsSync(candidate));
  if (!binary) throw new Error("Chrome was not found. Set CHROME_PATH to its location.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "minimart-tests-"));
  fs.mkdirSync(path.join(profile, "Default"), { recursive: true });
  fs.writeFileSync(path.join(profile, "Default", "Preferences"), JSON.stringify({
    download: { default_directory: path.join(profile, "downloads"), prompt_for_download: false, directory_upgrade: true },
    profile: { default_content_setting_values: { automatic_downloads: 1 } },
  }));
  const child = cp.spawn(binary, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    `--host-resolver-rules=${BLOCKED_HOSTS.map((host) => `MAP ${host} 127.0.0.1:1`).join(", ")}`,
    "about:blank",
  ], { stdio: "ignore" });

  const portFile = path.join(profile, "DevToolsActivePort");
  const deadline = Date.now() + 20000;
  while (!fs.existsSync(portFile) || fs.readFileSync(portFile, "utf8").trim().split("\n").length < 2) {
    if (Date.now() > deadline) {
      child.kill();
      throw new Error("Chrome did not start within 20 seconds.");
    }
    await sleep(50);
  }
  const [port, wsPath] = fs.readFileSync(portFile, "utf8").trim().split("\n");
  const cdp = await Cdp.connect(`ws://127.0.0.1:${port.trim()}${wsPath.trim()}`);

  const close = async () => {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    await cdp.send("Browser.close").catch(() => {});
    await Promise.race([exited, sleep(5000)]);
    child.kill();
    cdp.close();
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
  };
  return { cdp, close, profile };
}

module.exports = { launch, BLOCKED_HOSTS };
