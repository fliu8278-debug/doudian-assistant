import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('应用侧边栏', () => {
  it('显示视频抽帧入口', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('视频');
    expect(markup).toContain('视频工具');
    expect(markup).toContain('视频抽帧');
  });
});
