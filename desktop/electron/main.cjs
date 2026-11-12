"use strict";

const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

app.setName("Atlas");

const API_PORT = 43121;
const WEB_PORT = 43122;
const API_ORIGIN = `http://127.0.0.1:${API_PORT}`;
const WEB_ORIGIN = `http://127.0.0.1:${WEB_PORT}`;
const children = [];
let mainWindow;

function persistedSecret(userData) {
  const secretPath = path.join(userData, "instance.secret");
  try {
    const existing = fs.readFileSync(secretPath, "utf8").trim();
    if (existing.length >= 48) return existing;
  } catch {}
  const secret = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(secretPath, secret, { mode: 0o600 });
  try { fs.chmodSync(secretPath, 0o600); } catch {}
  return secret;
}

function spawnService(command, args, options) {
  const child = spawn(command, args, { stdio: "ignore", windowsHide: true, ...options });
  children.push(child);
  child.on("error", error => console.error("Atlas service failed to start:", error));
  return child;
}

async function waitForHealth(url, child, label) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${label} exited before becoming ready.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`${label} did not become ready within 45 seconds.`);
}

function startBackend(userData) {
  const executable = path.join(process.resourcesPath, "runtime", process.platform === "win32" ? "atlas-api.exe" : "atlas-api");
  if (!fs.existsSync(executable)) throw new Error("The bundled Atlas API sidecar is missing.");
  return spawnService(executable, [], {
    env: {
      ...process.env,
      ATLAS_USER_DATA_DIR: userData,
      ATLAS_API_PORT: String(API_PORT),
      JWT_SECRET: persistedSecret(userData),
      FRONTEND_ORIGIN: WEB_ORIGIN,
      CORS_ORIGINS: WEB_ORIGIN,
      ENVIRONMENT: "development"
    }
  });
}

function startFrontend() {
  const server = path.join(process.resourcesPath, "runtime", "frontend", "server.js");
  if (!fs.existsSync(server)) throw new Error("The bundled Atlas frontend server is missing.");
  return spawnService(process.execPath, [server], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "127.0.0.1",
      PORT: String(WEB_PORT),
      NEXT_PUBLIC_API_URL: `${API_ORIGIN}/api/v1`,
      NODE_ENV: "production"
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: "#080d1d",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== WEB_ORIGIN && !url.startsWith(WEB_ORIGIN + "/")) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
  return mainWindow.loadURL(WEB_ORIGIN);
}

async function stopServices() {
  for (const child of children.splice(0).reverse()) {
    if (child.exitCode === null) child.kill();
  }
}

app.whenReady().then(async () => {
  try {
    const userData = app.getPath("userData");
    fs.mkdirSync(userData, { recursive: true });
    const api = startBackend(userData);
    await waitForHealth(`${API_ORIGIN}/health`, api, "Atlas API");
    const frontend = startFrontend();
    await waitForHealth(WEB_ORIGIN, frontend, "Atlas frontend");
    await createWindow();
  } catch (error) {
    console.error(error);
    await dialog.showMessageBox({
      type: "error",
      title: "Atlas could not start",
      message: "Atlas could not start its local services.",
      detail: error instanceof Error ? error.message : String(error)
    });
    await stopServices();
    app.quit();
  }
});

app.on("before-quit", () => { void stopServices(); });
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && mainWindow) mainWindow.show();
});
