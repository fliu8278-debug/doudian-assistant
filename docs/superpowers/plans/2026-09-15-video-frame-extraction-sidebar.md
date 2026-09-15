# 视频抽帧侧边栏入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在侧边栏新增“视频 > 视频工具 > 视频抽帧”入口，并显示可访问的功能占位页。

**Architecture:** 复用 `App.tsx` 已有的页面联合类型、分组展开状态、`NavGroup` 和条件渲染。视频抽帧是单一占位组件，不建立路由、接口、数据库表或额外文件。

**Tech Stack:** React 19、TypeScript、Vite。

---

## File Structure

- Modify: `src/app/App.tsx` — 定义页面标识，渲染视频分组和占位页。
- Create: `src/app/App.test.tsx` — 服务端渲染应用，断言视频导航入口存在。
- Modify: `docs/superpowers/plans/2026-09-15-video-frame-extraction-sidebar.md` — 勾选已完成步骤。

### Task 1: 新增视频抽帧导航与占位页

**Files:**
- Modify: `src/app/App.tsx:9-14` — 在 `Page` 中增加 `videoFrameExtraction`。
- Modify: `src/app/App.tsx:31-36` — 初始化 `video` 分组展开状态。
- Modify: `src/app/App.tsx:119-121` — 在“商品”和“记录”之间加入视频分组。
- Modify: `src/app/App.tsx:135-148` — 为 `videoFrameExtraction` 单独渲染占位页。
- Modify: `src/app/App.tsx:151` 后 — 声明仅用于该占位页的组件。
- Create: `src/app/App.test.tsx` — 断言首次渲染包含视频分组与抽帧入口。

- [x] **Step 1: 验证当前应用可通过类型检查**

Run: `npm run typecheck`

Expected: exit code 0。

- [x] **Step 2: 编写视频导航的失败测试**

创建 `src/app/App.test.tsx`：

```tsx
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
```

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL，因为侧边栏尚未包含“视频抽帧”。

- [x] **Step 3: 扩展页面状态并添加导航项**

在 `Page` 类型和 `openGroups` 初始状态中加入视频标识；紧接“商品”分组后插入：

```tsx
<NavGroup
  open={openGroups.video}
  title="视频"
  onToggle={() => setOpenGroups(toggleGroup('video'))}
>
  <div className="navParent">视频工具</div>
  <div className="subNav">
    <button
      className={navClass(page === 'videoFrameExtraction', 'subItem')}
      onClick={() => setPage('videoFrameExtraction')}
      type="button"
    >
      视频抽帧
    </button>
  </div>
</NavGroup>
```

- [x] **Step 4: 添加视频抽帧占位页并接入条件渲染**

在主内容条件渲染中先匹配 `page === 'videoFrameExtraction'`，并添加：

```tsx
function VideoFrameExtractionPlaceholder() {
  return (
    <div className="pageHeader">
      <div>
        <h1>视频抽帧</h1>
        <p>视频导入、抽帧和导出功能即将推出。</p>
      </div>
    </div>
  );
}
```

- [x] **Step 5: 验证新测试、类型检查与生产构建**

Run: `npm test -- src/app/App.test.tsx && npm run typecheck && npm run build`

Expected: 三个命令均以 exit code 0 结束；构建结果写入已忽略的 `dist/` 和 `build/`。

- [x] **Step 6: 手动验证导航交互**

Run: `npm run dev`

Expected: 浏览器打开 `http://127.0.0.1:5173` 后，侧边栏“商品”和“记录”之间出现“视频”；展开后点击“视频抽帧”，导航项为激活状态，主区域显示“视频抽帧”。按 `Ctrl+C` 结束开发服务。

- [x] **Step 7: 提交并推送**

```bash
git add src/app/App.tsx src/app/App.test.tsx docs/superpowers/plans/2026-09-15-video-frame-extraction-sidebar.md
git commit -m "feat: add video frame extraction navigation"
git push
```

## Self-Review

- Spec coverage: 唯一需求“视频分组、视频工具、视频抽帧、占位页”均由 Task 1 覆盖。
- Placeholder scan: 未使用 TBD、TODO 或未定义接口。
- Type consistency: 页面标识始终使用 `videoFrameExtraction`，分组键始终使用 `video`。
