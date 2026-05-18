import { app, BrowserWindow, shell } from "electron";
import fs from "node:fs";
import path from "node:path";

const PORT = 5173;
let localServer;
let mainWindow;
let splashWindow;

async function createWindow() {
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
    icon: path.resolve(app.getAppPath(), "public", "assets", "sathi-connect-logo-transparent.png"),
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

  mainWindow.once("ready-to-show", async () => {
    const remainingSplashMs = Math.max(0, 6000 - (Date.now() - splashStartedAt));
    if (remainingSplashMs) await sleep(remainingSplashMs);
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
  });

  await mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
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
    icon: path.resolve(app.getAppPath(), "public", "assets", "sathi-connect-logo-transparent.png"),
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
  if (await isServerReady()) return;
  configureRuntimePaths();
  const { startServer } = await import("../src/server.js");
  const started = await startServer({ port: PORT, silent: true });
  localServer = started.server;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isServerReady()) return;
    await sleep(250);
  }

  throw new Error("Sathi-Connect local API did not start.");
}

async function isServerReady() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/config`);
    return response.ok;
  } catch {
    return false;
  }
}

function configureRuntimePaths() {
  const appRoot = app.getAppPath();
  const userData = app.getPath("userData");
  const dataDir = path.join(userData, "data");
  const logDir = path.join(userData, "logs");
  const configDir = path.join(userData, "config");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });

  const packagedEnvFile = path.join(configDir, ".env");
  const bundledEnvFile = path.join(appRoot, ".env");
  if (!fs.existsSync(packagedEnvFile) && fs.existsSync(bundledEnvFile)) {
    fs.copyFileSync(bundledEnvFile, packagedEnvFile);
  } else if (fs.existsSync(packagedEnvFile) && fs.existsSync(bundledEnvFile)) {
    mergeMissingEnvValues(packagedEnvFile, bundledEnvFile);
  }

  process.env.SATHI_ENV_FILE = packagedEnvFile;
  process.env.SATHI_DATA_DIR = dataDir;
  process.env.SATHI_LOG_DIR = logDir;
  process.env.SATHI_DB_FILE = path.join(dataDir, "saathi-connect.sqlite");
  process.env.SATHI_PUBLIC_KEY_FILE = path.join(appRoot, "keys", "public.pem");
  process.env.SATHI_LICENSE_FILE = path.join(dataDir, "license.lic");
  process.env.SATHI_LICENSE_RUNTIME_FILE = path.join(dataDir, "license-runtime.json");
  process.env.SATHI_LOG_FILE = path.join(logDir, "server.log");
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

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (localServer) localServer.close();
  if (process.platform !== "darwin") app.quit();
});
