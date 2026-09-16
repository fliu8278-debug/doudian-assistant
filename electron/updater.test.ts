import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { startAutoUpdater } from './updater.cjs';

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

  it('在打包环境检查更新并在用户确认后下载和安装', async () => {
    const autoUpdater = createUpdater();
    const dialog = { showMessageBox: vi.fn().mockResolvedValue({ response: 0 }) };

    startAutoUpdater({
      app: { isPackaged: true },
      autoUpdater,
      dialog,
      getWindow: () => ({ id: 1 }),
      log: { error: vi.fn() }
    });
    autoUpdater.emit('update-available', { version: '0.2.0' });
    await new Promise(setImmediate);
    autoUpdater.emit('update-downloaded');
    await new Promise(setImmediate);

    expect(autoUpdater.autoDownload).toBe(false);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
    expect(autoUpdater.downloadUpdate).toHaveBeenCalledOnce();
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce();
  });
});
