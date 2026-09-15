import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App, VideoFrameRateWorkbench } from './App';

describe('应用侧边栏', () => {
  it('显示视频抽帧入口', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('视频');
    expect(markup).toContain('视频工具');
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
});
