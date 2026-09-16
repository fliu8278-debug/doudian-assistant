# Update Progress UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser-default updater progress bar with the approved status-driven download progress UI.

**Architecture:** Keep the existing Electron `download-progress` state and render it in `UpdateDialog`. The component derives a safe integer percentage and only displays transferred/total sizes when both are supplied; CSS supplies the track, fill, metadata row, and stage labels.

**Tech Stack:** React 19, TypeScript, Vitest, existing plain CSS.

---

## File structure

- Modify: `src/app/components/UpdateDialog.tsx` — derive presentation values and replace the native progress element.
- Modify: `src/app/components/UpdateDialog.test.tsx` — lock down the rendered download state and no-size fallback.
- Modify: `src/app/styles.css` — style the approved update progress component.

### Task 1: Lock down the approved updater download state

**Files:**
- Modify: `src/app/components/UpdateDialog.test.tsx:6-18`

- [ ] **Step 1: Replace the native progress assertion with a failing custom-component test**

```tsx
state={{ phase: 'downloading', currentVersion: '0.1.1', percent: 42, version: '0.1.2', transferred: 42 * 1024 * 1024, total: 100 * 1024 * 1024 }}

expect(markup).toContain('下载更新包');
expect(markup).toContain('42%');
expect(markup).toContain('已下载 42 MB');
expect(markup).toContain('共 100 MB');
expect(markup).toContain('检查更新');
expect(markup).toContain('重启安装');
expect(markup).not.toContain('<progress');
```

- [ ] **Step 2: Add the no-size fallback test**

```tsx
const markup = renderToStaticMarkup(<UpdateDialog
  onCheck={vi.fn()} onDownload={vi.fn()} onOpenRelease={vi.fn()} onRestart={vi.fn()}
  state={{ phase: 'downloading', currentVersion: '0.1.1', percent: 7, version: '0.1.2' }}
/>);

expect(markup).not.toContain('已下载');
expect(markup).not.toContain('共 ');
```

- [ ] **Step 3: Run the focused test and confirm it fails**

Run: `npm test -- src/app/components/UpdateDialog.test.tsx`

Expected: FAIL because the current component still renders `<progress>`.

### Task 2: Render the stateful progress component

**Files:**
- Modify: `src/app/components/UpdateDialog.tsx:11-31`

- [ ] **Step 1: Add safe presentation helpers above the component**

```tsx
function formatBytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}
```

- [ ] **Step 2: Derive the download display data inside `UpdateDialog`**

```tsx
const percent = Math.max(0, Math.min(100, Math.round(state.percent ?? 0)));
const hasSize = typeof state.transferred === 'number' && typeof state.total === 'number' && state.total > 0;
```

- [ ] **Step 3: Replace the native `<progress>` branch with the approved markup**

```tsx
{state.phase === 'downloading' ? <section className="updateProgress" aria-label={`下载进度 ${percent}%`} aria-live="polite">
  <div className="updateProgressHead"><span>下载更新包</span><strong>{percent}%</strong></div>
  <div aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className="updateProgressTrack" role="progressbar"><i style={{ width: `${percent}%` }} /></div>
  {hasSize ? <div className="updateProgressMeta"><span>已下载 {formatBytes(state.transferred!)}</span><span>共 {formatBytes(state.total!)}</span></div> : null}
  <div className="updateProgressStages"><span className="done">检查更新</span><span className="active">下载更新包</span><span>重启安装</span></div>
</section> : null}
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `npm test -- src/app/components/UpdateDialog.test.tsx`

Expected: 3 tests passed.

### Task 3: Apply the approved visual treatment

**Files:**
- Modify: `src/app/styles.css:259-260`

- [ ] **Step 1: Replace the default-progress rules with component styles**

```css
.updateProgress { margin: 16px 20px; }
.updateProgressHead, .updateProgressMeta, .updateProgressStages { display: flex; align-items: center; justify-content: space-between; }
.updateProgressHead { color: #52657d; font-size: 13px; }
.updateProgressHead strong { color: #1769e0; font-size: 20px; font-variant-numeric: tabular-nums; }
.updateProgressTrack { height: 10px; margin-top: 9px; overflow: hidden; border-radius: 999px; background: #eaf0f7; box-shadow: inset 0 1px 2px rgba(28, 45, 66, 0.08); }
.updateProgressTrack i { display: block; height: 100%; border-radius: inherit; background: #1769e0; }
.updateProgressMeta { margin-top: 8px; color: #718197; font-size: 12px; font-variant-numeric: tabular-nums; }
.updateProgressStages { justify-content: flex-start; gap: 12px; margin-top: 14px; color: #8a98aa; font-size: 12px; }
.updateProgressStages span::before { display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 50%; background: #cad5e2; content: ''; }
.updateProgressStages .done { color: #397456; }.updateProgressStages .done::before { background: #34a469; }.updateProgressStages .active { color: #1769e0; font-weight: 700; }.updateProgressStages .active::before { background: #1769e0; }
```

- [ ] **Step 2: Run full verification**

Run: `npm test && npm run typecheck && npm run dist:win && git diff --check`

Expected: all test files pass, TypeScript exits 0, Windows installer is generated, and Git reports no whitespace errors.

- [ ] **Step 3: Commit the implementation**

```bash
git add src/app/components/UpdateDialog.tsx src/app/components/UpdateDialog.test.tsx src/app/styles.css
git commit -m "feat: improve update download progress UI"
```
