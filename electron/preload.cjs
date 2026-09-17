function createUpdaterBridge(ipcRenderer) {
  return {
    getState: () => ipcRenderer.invoke('updater:get-state'),
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    cancelDownload: () => ipcRenderer.invoke('updater:cancel-download'),
    restart: () => ipcRenderer.invoke('updater:restart'),
    setBackground: (enabled) => ipcRenderer.invoke('updater:set-background', Boolean(enabled)),
    skip: () => ipcRenderer.invoke('updater:skip'),
    openRelease: () => ipcRenderer.invoke('updater:open-release'),
    onState: (listener) => {
      const receive = (_event, state) => listener(state);
      ipcRenderer.on('updater:state', receive);
      return () => ipcRenderer.removeListener('updater:state', receive);
    }
  };
}

if (process.versions.electron) {
  const { contextBridge, ipcRenderer } = require('electron');
  contextBridge.exposeInMainWorld('doudianUpdater', createUpdaterBridge(ipcRenderer));
}

module.exports = { createUpdaterBridge };
