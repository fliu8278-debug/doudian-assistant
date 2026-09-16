import { describe, expect, it, vi } from 'vitest';
import { createUpdaterBridge } from './preload.cjs';

describe('createUpdaterBridge', () => {
  it('exposes updater commands and removes state listeners', async () => {
    const ipcRenderer = {
      invoke: vi.fn().mockResolvedValue({ phase: 'idle' }),
      on: vi.fn(),
      removeListener: vi.fn()
    };
    const bridge = createUpdaterBridge(ipcRenderer);
    const listener = vi.fn();

    await bridge.check();
    const stop = bridge.onState(listener);
    stop();

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('updater:check');
    expect(ipcRenderer.on).toHaveBeenCalledWith('updater:state', expect.any(Function));
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('updater:state', expect.any(Function));
  });
});
