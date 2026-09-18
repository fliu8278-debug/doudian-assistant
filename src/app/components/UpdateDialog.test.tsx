import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { UpdateDialog } from './UpdateDialog';

describe('UpdateDialog', () => {
  it('在检查更新时不把当前版本伪装成新版本', () => {
    const markup = renderToStaticMarkup(<UpdateDialog
      onCheck={vi.fn()} onDownload={vi.fn()} onOpenRelease={vi.fn()} onRestart={vi.fn()}
      state={{ phase: 'checking', currentVersion: '0.1.11' }}
    />);

    expect(markup).toContain('正在检查更新');
    expect(markup).toContain('正在检查最新版本');
    expect(markup).not.toContain('发现新版本');
  });

  it('uses an inline SVG for the update icon instead of a font glyph', () => {
    const markup = renderToStaticMarkup(<UpdateDialog
      onCheck={vi.fn()} onDownload={vi.fn()} onOpenRelease={vi.fn()} onRestart={vi.fn()}
      state={{ phase: 'available', currentVersion: '0.1.1', version: '0.1.2' }}
    />);

    expect(markup).toContain('data-icon="update"');
    expect(markup).toContain('viewBox="0 0 24 24"');
  });

  it('offers cancel and skip actions before the update starts', () => {
    const markup = renderToStaticMarkup(<UpdateDialog
      onCheck={vi.fn()} onDownload={vi.fn()} onOpenRelease={vi.fn()} onRestart={vi.fn()}
      state={{ phase: 'available', currentVersion: '0.1.8', version: '0.1.9' }}
    />);

    expect(markup).toContain('取消');
    expect(markup).toContain('跳过此版本');
    expect(markup).toContain('立即更新');
    expect(markup).toContain('data-icon="download"');
    expect(markup).not.toContain('↓ 立即更新');
  });

  it('uses the Cockpit-style progress layout while an update downloads', () => {
    const markup = renderToStaticMarkup(<UpdateDialog
      onCheck={vi.fn()}
      onDownload={vi.fn()}
      onOpenRelease={vi.fn()}
      onRestart={vi.fn()}
      state={{
        phase: 'downloading', currentVersion: '0.1.1', percent: 42, version: '0.1.2',
        transferred: 42 * 1024 * 1024, total: 100 * 1024 * 1024
      }}
    />);

    expect(markup).toContain('发现新版本');
    expect(markup).toContain('下载中… 42%');
    expect(markup).toContain('updateProgressText');
    expect(markup).not.toContain('<progress');
  });

  it('puts a real cancellation control next to the download progress', () => {
    const markup = renderToStaticMarkup(<UpdateDialog
      onCheck={vi.fn()} onDownload={vi.fn()} onOpenRelease={vi.fn()} onRestart={vi.fn()}
      state={{ phase: 'downloading', currentVersion: '0.1.8', percent: 42, version: '0.1.9' }}
    />);

    expect(markup).toContain('aria-label="取消下载"');
    expect(markup).toContain('data-icon="restart"');
    expect(markup).not.toContain('⟳ 下载中…');
  });

  it('does not add transfer figures to the reference progress layout', () => {
    const markup = renderToStaticMarkup(<UpdateDialog
      onCheck={vi.fn()} onDownload={vi.fn()} onOpenRelease={vi.fn()} onRestart={vi.fn()}
      state={{ phase: 'downloading', currentVersion: '0.1.1', percent: 7, version: '0.1.2', transferred: 7 * 1024 * 1024, total: 100 * 1024 * 1024 }}
    />);

    expect(markup).not.toContain('已下载');
    expect(markup).not.toContain('共 ');
  });

  it('offers an explicit restart only after the update is ready', () => {
    const markup = renderToStaticMarkup(<UpdateDialog
      onCheck={vi.fn()}
      onDownload={vi.fn()}
      onOpenRelease={vi.fn()}
      onRestart={vi.fn()}
      state={{ phase: 'ready', currentVersion: '0.1.1', version: '0.1.2', releaseNotes: '修复视频预览' }}
    />);

    expect(markup).toContain('v0.1.2 已就绪，重启后生效。');
    expect(markup).toContain('立即重启');
    expect(markup).toContain('修复视频预览');
    expect(markup).toContain('跳过此版本');
    expect(markup).toContain('data-icon="restart"');
    expect(markup).not.toContain('⟳ 立即重启');
  });

  it('shows the restart-ready notice in the approved update view', () => {
    const markup = renderToStaticMarkup(<UpdateDialog
      onCheck={vi.fn()}
      onDownload={vi.fn()}
      onOpenRelease={vi.fn()}
      onRestart={vi.fn()}
      state={{ phase: 'ready', currentVersion: '0.1.1', version: '0.1.2' }}
    />);

    expect(markup).toContain('v0.1.2 已就绪，重启后生效。');
    expect(markup).toContain('立即重启');
    expect(markup).toContain('稍后');
  });

  it('shows the update-success view after the app restarts on the new version', () => {
    const markup = renderToStaticMarkup(<UpdateDialog
      onCheck={vi.fn()}
      onDownload={vi.fn()}
      onOpenRelease={vi.fn()}
      onRestart={vi.fn()}
      state={{ phase: 'idle', currentVersion: '0.1.2', justUpdated: true, releaseNotes: '修复视频预览' }}
    />);

    expect(markup).toContain('🎉 更新成功！');
    expect(markup).toContain('更新已完成，当前版本 v0.1.2');
    expect(markup).toContain('我知道了');
    expect(markup).toContain('data-icon="confirm"');
    expect(markup).not.toContain('✓ 我知道了');
  });

  it('更新成功视图不混入下一次下载状态', () => {
    const markup = renderToStaticMarkup(<UpdateDialog
      onCheck={vi.fn()} onDownload={vi.fn()} onOpenRelease={vi.fn()} onRestart={vi.fn()}
      state={{ phase: 'downloading', currentVersion: '0.1.8', version: '0.1.12', justUpdated: true, percent: 63 }}
    />);

    expect(markup).toContain('更新已完成，当前版本 v0.1.8');
    expect(markup).toContain('我知道了');
    expect(markup).not.toContain('下载中… 63%');
  });

  it('reserves “我知道了” for the successful update view', () => {
    for (const state of [
      { phase: 'available' as const, currentVersion: '0.1.9', version: '0.1.10' },
      { phase: 'downloading' as const, currentVersion: '0.1.9', version: '0.1.10' },
      { phase: 'ready' as const, currentVersion: '0.1.9', version: '0.1.10' }
    ]) {
      const markup = renderToStaticMarkup(<UpdateDialog
        onCheck={vi.fn()} onDownload={vi.fn()} onOpenRelease={vi.fn()} onRestart={vi.fn()}
        state={state}
      />);

      expect(markup).not.toContain('我知道了');
    }
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
