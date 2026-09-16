import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  it('publishes updater assets from the public release repository', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.build.publish[0]).toMatchObject({ provider: 'github', repo: 'doudian-assistant-releases' });
    expect(packageJson.build.win.verifyUpdateCodeSignature).toBe(false);
  });

  it('persists background downloads and opens the release page on demand', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'doudian-updater-test-'));
    const settingsPath = join(directory, 'settings.json');
    const openExternal = vi.fn().mockResolvedValue(undefined);
    try {
      const first = startAutoUpdater({
        app: { isPackaged: true, getVersion: () => '0.1.1' }, autoUpdater: createUpdater(), settingsPath, log: { error: vi.fn() }
      });
      first.setBackground(true);
      const autoUpdater = createUpdater();
      const restored = startAutoUpdater({
        app: { isPackaged: true, getVersion: () => '0.1.1' }, autoUpdater, openExternal, settingsPath, log: { error: vi.fn() }
      });

      autoUpdater.emit('update-available', { version: '0.1.2' });
      await new Promise(setImmediate);
      await restored.openRelease();

      expect(restored.getState()).toMatchObject({ backgroundEnabled: true });
      expect(autoUpdater.downloadUpdate).toHaveBeenCalledOnce();
      expect(openExternal).toHaveBeenCalledWith('https://github.com/fliu8278-debug/doudian-assistant-releases/releases/latest');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('shows downloaded release notes once after the app upgrades', () => {
    const directory = mkdtempSync(join(tmpdir(), 'doudian-updater-test-'));
    const settingsPath = join(directory, 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({ pendingReleaseNotes: '修复视频预览', pendingVersion: '0.1.2' }));
    try {
      const firstRun = startAutoUpdater({
        app: { isPackaged: true, getVersion: () => '0.1.2' }, autoUpdater: createUpdater(), settingsPath, log: { error: vi.fn() }
      });
      const secondRun = startAutoUpdater({
        app: { isPackaged: true, getVersion: () => '0.1.2' }, autoUpdater: createUpdater(), settingsPath, log: { error: vi.fn() }
      });

      expect(firstRun.getState()).toMatchObject({ justUpdated: true, releaseNotes: '修复视频预览' });
      expect(secondRun.getState()).not.toHaveProperty('justUpdated', true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
