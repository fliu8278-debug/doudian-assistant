import { describe, expect, it } from 'vitest';
import { readInitialUpdateState, updateActionLabel } from './updater';

describe('updater UI state', () => {
  it('keeps browser previews idle without an Electron bridge', async () => {
    await expect(readInitialUpdateState(undefined)).resolves.toMatchObject({
      phase: 'idle',
      currentVersion: '开发预览'
    });
  });

  it('formats sidebar update actions from the lifecycle state', () => {
    expect(updateActionLabel({ phase: 'downloading', percent: 42 })).toBe('下载中 42%');
    expect(updateActionLabel({ phase: 'ready' })).toBe('重启更新');
  });
});
