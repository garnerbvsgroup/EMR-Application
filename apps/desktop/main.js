const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("node:path");

const DESKTOP_HOST = "127.0.0.1";
const DESKTOP_PORT = 3210;

let mainWindow = null;
let stopServer = null;
let isQuitting = false;

function resolveDesktopRuntimePaths() {
  if (app.isPackaged) {
    return {
      serverModulePath: path.join(process.resourcesPath, "server", "index.cjs"),
      clientDistPath: path.join(process.resourcesPath, "client"),
    };
  }

  return {
    serverModulePath: path.join(__dirname, "runtime", "server", "index.cjs"),
    clientDistPath: path.join(__dirname, "runtime", "client"),
  };
}

async function bootLocalServer() {
  const { serverModulePath, clientDistPath } = resolveDesktopRuntimePaths();
  process.env.REDWOOD_CLIENT_DIST = clientDistPath;
  process.env.REDWOOD_DATA_DIR = path.join(app.getPath("userData"), "runtime-data");
  const serverModule = require(serverModulePath);
  const runtime = await serverModule.startServer({
    host: DESKTOP_HOST,
    port: DESKTOP_PORT,
  });
  stopServer = serverModule.stopServer;
  return runtime;
}

function createWindow() {
  const iconPath = path.join(__dirname, "assets", "icon.png");
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#101820",
    show: false,
    autoHideMenuBar: true,
    title: "Garner Emergency Response",
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Desktop renderer finished loading.");
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("Desktop renderer failed to load:", { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Desktop renderer process exited:", details);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== `http://${DESKTOP_HOST}:${DESKTOP_PORT}/`) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.loadURL(`http://${DESKTOP_HOST}:${DESKTOP_PORT}`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function shutdownServer() {
  if (!stopServer) {
    return;
  }

  const closeServer = stopServer;
  stopServer = null;
  await closeServer();
}

app.on("before-quit", async (event) => {
  if (isQuitting) {
    return;
  }

  isQuitting = true;
  event.preventDefault();
  try {
    await shutdownServer();
  } finally {
    app.exit();
  }
});

app.whenReady().then(async () => {
  try {
    await bootLocalServer();
    createWindow();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("Desktop Launch Failed", message);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});