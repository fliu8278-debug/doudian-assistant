# 视频抽帧界面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为本地视频降帧工具实现左右两栏的可交互 UI：左侧导入与处理，右侧输出视频、处理进度及下载状态。

**Architecture:** 在既有 `App.tsx` 中替换视频抽帧占位组件，以原生文件输入和 React 本地状态演示选择视频、帧率设置和处理阶段。保留真实 FFmpeg 处理为下一阶段；本阶段用可见的模拟进度表达完整的产品流程。样式追加到既有 `styles.css`，不引入新依赖。

**Tech Stack:** React 19、TypeScript、Vitest、既有 CSS。

---

### Task 1: 锁定初始页面结构

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/App.tsx`

- [ ] **Step 1: 写入失败的页面结构测试**

在 `src/app/App.test.tsx` 的“应用侧边栏”测试后新增：

```tsx
it('提供左侧处理与右侧输出视频工作区', () => {
  const markup = renderToStaticMarkup(<App />);

  expect(markup).toContain('源视频与参数');
  expect(markup).toContain('导入本地视频');
  expect(markup).toContain('目标帧率');
  expect(markup).toContain('开始处理');
  expect(markup).toContain('输出视频');
  expect(markup).toContain('处理进度');
  expect(markup).toContain('下载视频');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL，缺少“源视频与参数”。

- [ ] **Step 3: 用最小组件替换视频占位页**

在 `src/app/App.tsx` 中把 `VideoFrameExtractionPlaceholder` 替换为 `VideoFrameRateWorkbench`。组件须在初始渲染中输出：

```tsx
<section className="videoFramePanel videoFrameSourcePanel">
  <h2>源视频与参数</h2>
  <button type="button">导入本地视频</button>
  <label>目标帧率 <input aria-label="目标帧率" type="number" value={15} readOnly /> FPS</label>
  <button className="primaryButton" type="button">开始处理</button>
</section>
<section className="videoFramePanel videoFrameOutputPanel">
  <h2>输出视频</h2>
  <button disabled type="button">下载视频</button>
  <h3>处理进度</h3>
</section>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- src/app/App.test.tsx`

Expected: PASS，2 个测试通过。

- [ ] **Step 5: 提交测试与初始结构**

```bash
git add src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: add video processing workspace"
```

### Task 2: 实现本地 UI 状态与左右栏样式

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/styles.css`

- [ ] **Step 1: 实现文件选择与源视频状态**

在 `VideoFrameRateWorkbench` 中使用 `useRef<HTMLInputElement>` 和 `useState` 保存 `File | null`、源视频对象 URL、帧率和处理状态。文件输入限定为 `accept="video/mp4"`。选择后调用 `URL.createObjectURL(file)`，显示文件名和大小，并以 `<video controls src={sourceUrl}>` 预览；清除和卸载时调用 `URL.revokeObjectURL`。

- [ ] **Step 2: 实现处理状态演示**

将状态限定为 `idle | reading | encoding | complete`。点击“开始处理”仅在已有文件时生效，按以下顺序更新右栏：

```ts
setProcessingState('reading');
window.setTimeout(() => setProcessingState('encoding'), 700);
window.setTimeout(() => setProcessingState('complete'), 1400);
```

`complete` 时把源视频 URL 用作输出预览，显示 100% 和“处理完成”，并启用“下载视频”。下载按钮本阶段使用 `<a download>` 指向对象 URL，明确这是 UI 演示，真实重新编码将在 FFmpeg 阶段替换该 URL。

- [ ] **Step 3: 实现与现有软件一致的样式**

在 `src/app/styles.css` 新增 `videoFrame*` 类：

```css
.videoFrameGrid { display: grid; grid-template-columns: minmax(320px, .82fr) minmax(460px, 1.18fr); gap: 18px; }
.videoFramePanel { min-width: 0; padding: 20px; border: 1px solid #d6e3f2; border-radius: 12px; background: #fff; }
.videoFrameUpload { border: 1px dashed #9dc3f8; border-radius: 10px; background: #f8fbff; }
.videoFramePlayer { width: 100%; aspect-ratio: 16 / 9; border-radius: 8px; background: #161d27; }
```

为上传区、元数据、参数行、输出信息、三阶段进度、状态条和禁用下载按钮补足布局；在 `@media (max-width: 1100px)` 把 `.videoFrameGrid` 设为单列。

- [ ] **Step 4: 运行完整验证**

Run: `npm test && npm run typecheck && npm run build`

Expected: 所有测试、类型检查和生产构建通过。

- [ ] **Step 5: 打开本地预览并手动检查**

Run: `npm run dev:web`

Expected: 打开 `http://127.0.0.1:5173/` 后，点击“视频抽帧”可选择本地 MP4、设置帧率、启动进度演示，并在完成后看到右侧新视频预览与“下载视频”。

- [ ] **Step 6: 提交但不推送**

```bash
git add src/app/App.tsx src/app/styles.css
git commit -m "feat: build video frame rate UI"
```

Do not run `git push` until the user checks the local preview and explicitly confirms upload.

## Self-Review

- Spec coverage: 左侧导入和开始处理、右侧输出预览和下载、进度阶段、默认 15 FPS、保留时长与原声提示、窄屏单列均由 Task 1 或 Task 2 覆盖。
- Placeholder scan: 不包含 TBD、TODO 或未定义接口。
- Type consistency: `VideoFrameRateWorkbench`、`sourceUrl`、`processingState` 和 `videoFrame*` 类在全部任务中保持一致。
