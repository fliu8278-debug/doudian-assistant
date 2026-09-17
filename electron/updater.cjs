const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname } = require('node:path');

const DEFAULT_RELEASE_URL = 'https://github.com/fliu8278-debug/doudian-assistant/releases/latest';

function startAutoUpdater({ app, autoUpdater, broadcast = () => {}, log = console, openExternal, releaseUrl = DEFAULT_RELEASE_URL, settingsPath }) {
  const settings = readSettings(settingsPath);
  const currentVersion = typeof app.getVersion === 'function' ? app.getVersion() : undefined;
  const justUpdated = app.isPackaged && settings.pendingVersion === currentVersion;
  let state = {
    phase: 'idle',
    currentVersion,
    backgroundEnabled: settings.backgroundEnabled,
    ...(justUpdated ? { justUpdated: true, releaseNotes: plainReleaseNotes(settings.pendingReleaseNotes), version: currentVersion } : {})
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
  const setBackground = (enabled) => {
    const next = publish({ backgroundEnabled: Boolean(enabled) });
    saveSettings(settingsPath, { ...settings, backgroundEnabled: next.backgroundEnabled });
    return next;
  };
  const openRelease = async () => {
    if (openExternal) await openExternal(state.releaseUrl ?? releaseUrl);
  };

  if (!app.isPackaged) return { check, download, getState: () => state, openRelease, restart, setBackground };

  saveSettings(settingsPath, {
    ...settings,
    lastRunVersion: currentVersion,
    pendingReleaseNotes: justUpdated ? undefined : settings.pendingReleaseNotes,
    pendingVersion: justUpdated ? undefined : settings.pendingVersion
  });
  autoUpdater.autoDownload = false;
  autoUpdater.on('checking-for-update', () => publish({ phase: 'checking', error: undefined }));
  autoUpdater.on('update-available', (info) => {
    publish({
      phase: 'available',
      version: info.version,
      releaseNotes: plainReleaseNotes(info.releaseNotes),
      releaseUrl
    });
    if (state.backgroundEnabled) void download();
  });
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
    releaseNotes: plainReleaseNotes(info.releaseNotes) ?? state.releaseNotes
  }));
  autoUpdater.on('update-downloaded', (info) => saveSettings(settingsPath, {
    ...settings,
    backgroundEnabled: state.backgroundEnabled,
    lastRunVersion: currentVersion,
    pendingReleaseNotes: plainReleaseNotes(info.releaseNotes) ?? state.releaseNotes,
    pendingVersion: info.version ?? state.version
  }));
  autoUpdater.on('error', (error) => {
    log.error('更新失败', error);
    publish({ phase: 'error', error: '更新失败，请稍后重试。' });
  });
  void check();

  return { check, download, getState: () => state, openRelease, restart, setBackground };
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
  ipcMain.handle('updater:open-release', () => coordinator.openRelease());
}

module.exports = { registerAutoUpdaterIpc, startAutoUpdater };

function plainReleaseNotes(notes) {
  if (typeof notes !== 'string') return undefined;
  return notes
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\/(?:p|div|h[1-6]|li|ul|ol)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (_match, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[entity])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function readSettings(settingsPath) {
  if (!settingsPath || !existsSync(settingsPath)) return { backgroundEnabled: false };
  try {
    const stored = JSON.parse(readFileSync(settingsPath, 'utf8'));
    return {
      backgroundEnabled: Boolean(stored.backgroundEnabled),
      lastRunVersion: stored.lastRunVersion,
      pendingReleaseNotes: stored.pendingReleaseNotes,
      pendingVersion: stored.pendingVersion
    };
  } catch {
    return { backgroundEnabled: false };
  }
}

function saveSettings(settingsPath, settings) {
  if (!settingsPath) return;
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings), 'utf8');
}
