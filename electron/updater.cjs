function startAutoUpdater({ app, autoUpdater, broadcast = () => {}, log = console }) {
  let state = {
    phase: 'idle',
    currentVersion: typeof app.getVersion === 'function' ? app.getVersion() : undefined,
    backgroundEnabled: false
  };
  const publish = (next) => {
    state = { ...state, ...next };
    broadcast(state);
    return state;
  };
  const check = async () => {
    if (!app.isPackaged) return state;
    publish({ phase: 'checking', error: undefined });
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      log.error('更新检查失败', error);
      publish({ phase: 'error', error: '检查更新失败，请稍后重试。' });
    }
    return state;
  };
  const download = async () => {
    if (!app.isPackaged || state.phase !== 'available') return state;
    publish({ phase: 'downloading', error: undefined, percent: 0 });
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('更新下载失败', error);
      publish({ phase: 'error', error: '下载更新失败，请稍后重试。' });
    }
    return state;
  };
  const restart = () => {
    if (state.phase === 'ready') autoUpdater.quitAndInstall();
  };
  const setBackground = (enabled) => publish({ backgroundEnabled: Boolean(enabled) });

  if (!app.isPackaged) return { check, download, getState: () => state, restart, setBackground };

  autoUpdater.autoDownload = false;
  autoUpdater.on('checking-for-update', () => publish({ phase: 'checking', error: undefined }));
  autoUpdater.on('update-available', (info) => publish({
    phase: 'available',
    version: info.version,
    releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    releaseUrl: info.releaseName
  }));
  autoUpdater.on('update-not-available', () => publish({ phase: 'not-available' }));
  autoUpdater.on('download-progress', (progress) => publish({
    phase: 'downloading',
    percent: Math.round(progress.percent),
    transferred: progress.transferred,
    total: progress.total
  }));
  autoUpdater.on('update-downloaded', (info) => publish({
    phase: 'ready',
    version: info.version ?? state.version,
    releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : state.releaseNotes
  }));
  autoUpdater.on('error', (error) => {
    log.error('更新失败', error);
    publish({ phase: 'error', error: '更新失败，请稍后重试。' });
  });
  void check();

  return { check, download, getState: () => state, restart, setBackground };
}

function registerAutoUpdaterIpc({ ipcMain, coordinator }) {
  ipcMain.handle('updater:get-state', () => coordinator.getState());
  ipcMain.handle('updater:check', () => coordinator.check());
  ipcMain.handle('updater:download', () => coordinator.download());
  ipcMain.handle('updater:restart', () => {
    coordinator.restart();
    return coordinator.getState();
  });
  ipcMain.handle('updater:set-background', (_event, enabled) => coordinator.setBackground(enabled));
}

module.exports = { registerAutoUpdaterIpc, startAutoUpdater };
