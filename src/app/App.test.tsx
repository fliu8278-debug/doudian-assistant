import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as AppModule from './App';
import { App, resolveVideoFramePreviewTask, resolveVideoFrameQueueProgress, VideoFrameRateWorkbench } from './App';
import { ShopList } from './pages/shops/ShopList';
import type { VideoFrameBatchTask } from './videoFrameBatch';

describe('应用侧边栏', () => {
  it('显示视频抽帧入口', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('视频');
    expect(markup).toContain('视频抽帧');
  });

  it('uses SVG icons for sidebar navigation instead of font glyphs', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('data-icon="shop"');
    expect(markup).toContain('data-icon="video"');
    expect(markup).not.toContain('>▣<');
    expect(markup).not.toContain('>▸<');
  });

  it('提供紧凑的上传处理与输出视频工作区', () => {
    const markup = renderToStaticMarkup(<VideoFrameRateWorkbench />);

    expect(markup).toContain('上传 MP4 视频');
    expect(markup).toContain('videoFrameUpload');
    expect(markup).toContain('随机抽帧');
    expect(markup).toContain('间隔抽帧');
    expect(markup).not.toContain('目标帧率');
    expect(markup).toContain('开始处理');
    expect(markup).toContain('批量处理结果');
    expect(markup).toContain('整体处理进度');
    expect(markup).toContain('下载全部视频');
    expect(markup).toContain('videoFramePage');
    expect(markup).not.toContain('videoFrameFileRow');
    expect(markup).not.toContain('videoFrameMetadata');
  });

  it('renders an independent workspace page for a sidebar entry', () => {
    expect(AppModule.WorkspacePlaceholder).toBeTypeOf('function');

    if (!AppModule.WorkspacePlaceholder) return;
    const markup = renderToStaticMarkup(
      <AppModule.WorkspacePlaceholder
        actionLabel="开始搜索"
        breadcrumb="商品 / 商品搜索"
        description="按关键词定位商品。"
        emptyDescription="输入关键词后开始搜索。"
        emptyTitle="还没有搜索结果"
        summary={[{ label: '今日搜索', value: '0' }]}
        title="商品搜索"
      />
    );

    expect(markup).toContain('商品 / 商品搜索');
    expect(markup).toContain('还没有搜索结果');
  });

  it('keeps the shop list inside the shared workspace frame', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('shopsWorkspace');
    expect(markup).toContain('workspaceBreadcrumb');
  });

  it('renders separated source and output video cards', () => {
    const markup = renderToStaticMarkup(<VideoFrameRateWorkbench />);

    expect(markup).toContain('videoFrameSourceCard');
    expect(markup).toContain('videoFrameOutputCard');
    expect(markup).toContain('videoFramePreview');
  });

  it('renders a batch-video queue and batch result controls', () => {
    const markup = renderToStaticMarkup(<VideoFrameRateWorkbench />);

    expect(markup).toContain('批量上传 MP4 视频');
    expect(markup).toContain('本次将处理');
    expect(markup).toContain('开始批量处理');
    expect(markup).toContain('批量处理结果');
    expect(markup).toContain('下载全部视频');
    expect(markup).toContain('multiple=""');
  });

  it('prefers the selected completed video when resolving the output preview', () => {
    const firstFile = new File(['a'], 'first.mp4', { lastModified: 1 });
    const secondFile = new File(['b'], 'second.mp4', { lastModified: 2 });
    const tasks: VideoFrameBatchTask[] = [
      { file: firstFile, job: { id: 'first', outputName: 'first-output.mp4', previewUrl: 'first-preview.mp4', progress: 100, settings: { mode: 'random', value: 1 }, status: 'complete' }, status: 'complete' },
      { file: secondFile, job: { id: 'second', outputName: 'second-output.mp4', previewUrl: 'second-preview.mp4', progress: 100, settings: { mode: 'random', value: 1 }, status: 'complete' }, status: 'complete' }
    ];

    expect(resolveVideoFramePreviewTask(tasks, `${firstFile.name}-${firstFile.lastModified}-${firstFile.size}`)?.file.name).toBe('first.mp4');
    expect(resolveVideoFramePreviewTask(tasks, '')?.file.name).toBe('second.mp4');
  });

  it('maps video queue task status to ring progress text', () => {
    expect(resolveVideoFrameQueueProgress(undefined)).toEqual({ label: '0%', value: 0 });
    expect(resolveVideoFrameQueueProgress({ file: new File(['a'], 'video.mp4'), job: { id: 'job', outputName: 'video.mp4', progress: 68, settings: { mode: 'random', value: 1 }, status: 'processing' }, status: 'processing' })).toEqual({ label: '68%', value: 68 });
    expect(resolveVideoFrameQueueProgress({ file: new File(['a'], 'video.mp4'), status: 'complete' })).toEqual({ label: '100%', value: 100 });
    expect(resolveVideoFrameQueueProgress({ file: new File(['a'], 'video.mp4'), status: 'failed' })).toEqual({ label: '失败', value: 100 });
  });

  it('uses a flat sidebar navigation instead of collapsible groups', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('sidebarNav');
    expect(markup).not.toContain('navGroupToggle');
  });

  it('renders a Cockpit-style update action and settings card', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('检查更新');
    expect(markup).toContain('软件更新');
  });

  it('renders the shop overview and quick tools as separate dashboard cards', () => {
    const markup = renderToStaticMarkup(
      <ShopList loading={false} onChanged={async () => undefined} refreshedAt={null} refreshing={false} shops={[]} />
    );

    expect(markup).toContain('shopDashboardGrid');
    expect(markup).toContain('shopQuickTools');
  });
});
