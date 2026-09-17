const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const net = require('node:net');
const path = require('node:path');
const { bundledBrowserPath } = require('./browser.cjs');
const { registerAutoUpdaterIpc, startAutoUpdater } = require('./updater.cjs');

let mainWindow;
let backendServer;
let updater;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

app.whenReady().then(startApp).catch(showStartupError);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  backendServer?.close();
});

app.on('activate', () => {
  if (!mainWindow && backendServer) {
    createWindow(`http://127.0.0.1:${backendServer.address().port}`);
  }
});

async function startApp() {
  process.env.DOUDIAN_TOOL_DATA_DIR ||= app.isPackaged
    ? path.join(app.getPath('userData'), 'data')
    : path.join(process.cwd(), 'data');
  process.env.DOUDIAN_FFMPEG_PATH ||= app.isPackaged
    ? path.join(process.resourcesPath, 'ffmpeg', 'win32-x64', 'ffmpeg.exe')
    : path.join(process.cwd(), 'vendor', 'ffmpeg', 'win32-x64', 'ffmpeg.exe');
  process.env.DOUDIAN_FFPROBE_PATH ||= app.isPackaged
    ? path.join(process.resourcesPath, 'ffmpeg', 'win32-x64', 'ffprobe.exe')
    : path.join(process.cwd(), 'vendor', 'ffmpeg', 'win32-x64', 'ffprobe.exe');
  if (app.isPackaged) process.env.DOUDIAN_BROWSER_EXECUTABLE ||= bundledBrowserPath(process.resourcesPath);
  const staticDir = path.join(__dirname, '..', 'dist');
  const port = await findAvailablePort(4173);
  const { startServer } = require(path.join(__dirname, '..', 'build', 'server', 'index.cjs'));
  const started = await startServer({ port, staticDir });

  backendServer = started.server;
  createWindow(started.url);
  updater = startAutoUpdater({
    app,
    autoUpdater,
    broadcast: (state) => mainWindow?.webContents.send('updater:state', state),
    openExternal: (url) => shell.openExternal(url),
    settingsPath: path.join(app.getPath('userData'), 'updater.json')
  });
  registerAutoUpdaterIpc({ ipcMain, coordinator: updater });
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: '抖店助手',
    backgroundColor: '#f4f6f8',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.loadURL(url);
  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const tryPort = (port) => {
      const server = net.createServer();
      server.unref();
      server.once('error', () => tryPort(port + 1));
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(port));
      });
    };

    tryPort(startPort);
  });
}

function showStartupError(error) {
  dialog.showErrorBox('启动失败', error instanceof Error ? error.stack || error.message : String(error));
  app.quit();
}
