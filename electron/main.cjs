const { app, BrowserWindow, dialog, shell } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const PORT = 5173;
let localServer;
let mainWindow;
let splashWindow;
let mainShown = false;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

async function createWindow() {
  try {
    logMain("window.create.start");
    const splashStartedAt = Date.now();
    splashWindow = await createSplashWindow();
    await ensureServer();

    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1180,
      minHeight: 760,
      title: "Sathi-Connect",
      backgroundColor: "#07111c",
      show: false,
      icon: resolveRuntimeFile("public", "assets", "sathi-connect-icon.ico"),
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });

    const showMainWindow = async (reason) => {
      if (mainShown) return;
      mainShown = true;
      logMain("window.main.show", { reason });
      const remainingSplashMs = Math.max(0, 2500 - (Date.now() - splashStartedAt));
      if (remainingSplashMs) await sleep(remainingSplashMs);
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
      mainWindow.maximize();
      mainWindow.show();
      mainWindow.focus();
    };

    mainWindow.once("ready-to-show", () => showMainWindow("ready-to-show"));
    mainWindow.webContents.once("did-finish-load", () => showMainWindow("did-finish-load"));
    mainWindow.webContents.once("dom-ready", () => setTimeout(() => showMainWindow("dom-ready"), 500));
    mainWindow.webContents.once("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      logMain("window.main.load.failed", { errorCode, errorDescription, validatedURL });
    });

    await mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
    setTimeout(() => showMainWindow("fallback-timeout"), 8000);
  } catch (error) {
    logMain("window.create.failed", serializeError(error));
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    dialog.showErrorBox("Sathi Connect startup failed", error?.message || String(error));
    app.quit();
  }
}

async function createSplashWindow() {
  const window = new BrowserWindow({
    width: 560,
    height: 340,
    frame: false,
    resizable: false,
    show: false,
    center: true,
    alwaysOnTop: true,
    title: "Sathi-Connect",
    backgroundColor: "#f4f9fe",
    icon: resolveRuntimeFile("public", "assets", "sathi-connect-icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await window.loadFile(path.resolve(app.getAppPath(), "electron", "splash.html"));
  window.show();
  window.focus();
  return window;
}

async function ensureServer() {
  logMain("server.ensure.start");
  if (await isServerReady()) {
    logMain("server.already.ready");
    return;
  }
  configureRuntimePaths();
  const serverFile = resolveRuntimeFile("src", "server.js");
  logMain("server.import.start", { serverFile });
  const { startServer } = await import(pathToFileURL(serverFile).href);
  const started = await startServer({ port: PORT, silent: true });
  localServer = started.server;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isServerReady()) {
      logMain("server.ready", { attempt });
      return;
    }
    await sleep(250);
  }

  throw new Error("Sathi-Connect local API did not start.");
}

function resolveRuntimeFile(...segments) {
  return path.join(resolveRuntimeRoot(), ...segments);
}

function resolveRuntimeRoot() {
  const appRoot = app.getAppPath();
  return appRoot.includes("app.asar")
    ? appRoot.replace("app.asar", "app.asar.unpacked")
    : appRoot;
}

async function isServerReady() {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${PORT}/api/config`, (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 300);
    });
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

function configureRuntimePaths() {
  const appRoot = app.getAppPath();
  const runtimeRoot = resolveRuntimeRoot();
  const userData = app.getPath("userData");
  const dataDir = path.join(userData, "data");
  const logDir = path.join(userData, "logs");
  const configDir = path.join(userData, "config");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });

  const packagedEnvFile = path.join(configDir, ".env");
  const bundledEnvFile = path.join(runtimeRoot, ".env");
  if (!fs.existsSync(packagedEnvFile) && fs.existsSync(bundledEnvFile)) {
    fs.copyFileSync(bundledEnvFile, packagedEnvFile);
  } else if (fs.existsSync(packagedEnvFile) && fs.existsSync(bundledEnvFile)) {
    mergeMissingEnvValues(packagedEnvFile, bundledEnvFile);
  }

  process.env.SATHI_ENV_FILE = packagedEnvFile;
  process.env.SATHI_DATA_DIR = dataDir;
  process.env.SATHI_LOG_DIR = logDir;
  process.env.SATHI_DB_FILE = path.join(dataDir, "saathi-connect.sqlite");
  process.env.SATHI_PUBLIC_KEY_FILE = path.join(runtimeRoot, "keys", "public.pem");
  process.env.SATHI_LICENSE_FILE = path.join(dataDir, "license.lic");
  process.env.SATHI_LICENSE_RUNTIME_FILE = path.join(dataDir, "license-runtime.json");
  process.env.SATHI_LOG_FILE = path.join(logDir, "server.log");
  process.env.SATHI_MAIN_LOG_FILE = path.join(logDir, "main.log");
  logMain("runtime.paths.configured", {
    appRoot,
    runtimeRoot,
    userData,
    envFile: process.env.SATHI_ENV_FILE,
    logFile: process.env.SATHI_LOG_FILE
  });
}

function mergeMissingEnvValues(targetFile, sourceFile) {
  const target = readEnvValues(targetFile);
  const source = readEnvValues(sourceFile);
  const next = { ...target };
  let changed = false;

  for (const [key, value] of Object.entries(source)) {
    if (String(value || "").trim() && !String(next[key] || "").trim()) {
      next[key] = value;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(targetFile, `${Object.entries(next).map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
  }
}

function readEnvValues(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      })
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logMain(event, details = {}) {
  try {
    const logFile = process.env.SATHI_MAIN_LOG_FILE || path.join(app.getPath("userData"), "logs", "main.log");
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, `${JSON.stringify({ at: new Date().toISOString(), event, ...details })}\n`);
  } catch {
    // Startup logging must never block the app.
  }
}

function serializeError(error) {
  return {
    name: error?.name,
    message: error?.message || String(error),
    stack: error?.stack
  };
}

process.on("uncaughtException", (error) => logMain("process.uncaughtException", serializeError(error)));
process.on("unhandledRejection", (error) => logMain("process.unhandledRejection", serializeError(error)));

if (gotSingleInstanceLock) {
  app.whenReady().then(createWindow).catch((error) => {
    logMain("app.ready.failed", serializeError(error));
    dialog.showErrorBox("Sathi Connect startup failed", error?.message || String(error));
    app.quit();
  });
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (localServer) localServer.close();
  if (process.platform !== "darwin") app.quit();
});
