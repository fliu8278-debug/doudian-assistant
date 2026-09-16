import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { registerAutoUpdaterIpc, startAutoUpdater } from './updater.cjs';

function createUpdater() {
  const updater = new EventEmitter();
  updater.checkForUpdates = vi.fn().mockResolvedValue();
  updater.downloadUpdate = vi.fn().mockResolvedValue();
  updater.quitAndInstall = vi.fn();
  return updater;
}

describe('startAutoUpdater', () => {
  it('在开发环境不检查更新', () => {
    const autoUpdater = createUpdater();

    startAutoUpdater({
      app: { isPackaged: false },
      autoUpdater,
      dialog: { showMessageBox: vi.fn() },
      getWindow: () => undefined,
      log: { error: vi.fn() }
    });

    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('发布下载进度，并且只有用户确认后才重启安装', async () => {
    const autoUpdater = createUpdater();
    const broadcast = vi.fn();

    const coordinator = startAutoUpdater({
      app: { isPackaged: true, getVersion: () => '0.1.1' },
      autoUpdater,
      broadcast,
      log: { error: vi.fn() }
    });

    autoUpdater.emit('update-available', { version: '0.2.0', releaseNotes: '修复视频预览' });
    await coordinator.download();
    autoUpdater.emit('download-progress', { percent: 42, transferred: 42, total: 100 });
    autoUpdater.emit('update-downloaded', { version: '0.2.0', releaseNotes: '修复视频预览' });

    expect(autoUpdater.autoDownload).toBe(false);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
    expect(autoUpdater.downloadUpdate).toHaveBeenCalledOnce();
    expect(broadcast).toHaveBeenCalledWith(expect.objectContaining({ phase: 'downloading', percent: 42 }));
    expect(broadcast).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready', version: '0.2.0' }));
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();

    coordinator.restart();

    expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce();
  });

  it('只注册页面所需的更新控制通道', async () => {
    const ipcMain = { handle: vi.fn() };
    const coordinator = startAutoUpdater({
      app: { isPackaged: false, getVersion: () => '0.1.1' },
      autoUpdater: createUpdater(),
      log: { error: vi.fn() }
    });

    registerAutoUpdaterIpc({ ipcMain, coordinator });

    expect(ipcMain.handle).toHaveBeenCalledWith('updater:get-state', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('updater:check', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('updater:download', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('updater:restart', expect.any(Function));
    expect(ipcMain.handle).toHaveBeenCalledWith('updater:set-background', expect.any(Function));
    const getState = ipcMain.handle.mock.calls.find(([channel]) => channel === 'updater:get-state')[1];
    expect(getState()).toMatchObject({ phase: 'idle', currentVersion: '0.1.1' });
  });
});
