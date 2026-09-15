import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as AppModule from './App';
import { App, VideoFrameRateWorkbench } from './App';

describe('应用侧边栏', () => {
  it('显示视频抽帧入口', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('视频');
    expect(markup).toContain('视频抽帧');
  });

  it('提供左侧处理与右侧输出视频工作区', () => {
    const markup = renderToStaticMarkup(<VideoFrameRateWorkbench />);

    expect(markup).toContain('源视频与参数');
    expect(markup).toContain('导入本地视频');
    expect(markup).toContain('目标帧率');
    expect(markup).toContain('开始处理');
    expect(markup).toContain('输出视频');
    expect(markup).toContain('处理进度');
    expect(markup).toContain('下载视频');
    expect(markup).toContain('videoFramePage');
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

  it('uses a flat sidebar navigation instead of collapsible groups', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('sidebarNav');
    expect(markup).not.toContain('navGroupToggle');
  });
});
