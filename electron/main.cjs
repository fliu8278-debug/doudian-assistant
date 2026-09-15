const { app, BrowserWindow, dialog } = require('electron');
const net = require('node:net');
const path = require('node:path');

let mainWindow;
let backendServer;

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
  const staticDir = path.join(__dirname, '..', 'dist');
  const port = await findAvailablePort(4173);
  const { startServer } = require(path.join(__dirname, '..', 'build', 'server', 'index.cjs'));
  const started = await startServer({ port, staticDir });

  backendServer = started.server;
  createWindow(started.url);
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
      sandbox: true
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
