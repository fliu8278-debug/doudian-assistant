import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { UpdateDialog } from './UpdateDialog';

describe('UpdateDialog', () => {
  it('shows progress while an update downloads', () => {
    const markup = renderToStaticMarkup(<UpdateDialog
      onCheck={vi.fn()}
      onDownload={vi.fn()}
      onOpenRelease={vi.fn()}
      onRestart={vi.fn()}
      state={{ phase: 'downloading', currentVersion: '0.1.1', percent: 42, version: '0.1.2' }}
    />);

    expect(markup).toContain('正在下载 v0.1.2');
    expect(markup).toContain('42%');
    expect(markup).toContain('<progress');
  });

  it('offers an explicit restart only after the update is ready', () => {
    const markup = renderToStaticMarkup(<UpdateDialog
      onCheck={vi.fn()}
      onDownload={vi.fn()}
      onOpenRelease={vi.fn()}
      onRestart={vi.fn()}
      state={{ phase: 'ready', currentVersion: '0.1.1', version: '0.1.2', releaseNotes: '修复视频预览' }}
    />);

    expect(markup).toContain('更新已准备好');
    expect(markup).toContain('重启更新');
    expect(markup).toContain('修复视频预览');
  });

  it('offers the release page when updating fails', () => {
    const markup = renderToStaticMarkup(<UpdateDialog
      onCheck={vi.fn()}
      onDownload={vi.fn()}
      onOpenRelease={vi.fn()}
      onRestart={vi.fn()}
      state={{ phase: 'error', currentVersion: '0.1.1', error: '下载更新失败，请稍后重试。' }}
    />);

    expect(markup).toContain('打开下载页');
  });
});
