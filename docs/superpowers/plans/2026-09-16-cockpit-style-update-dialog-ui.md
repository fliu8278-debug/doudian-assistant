# Cockpit-Style Update Dialog UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the real desktop update dialog match the approved Cockpit-style visual flow while retaining the existing Electron updater behaviour.

**Architecture:** Keep `UpdateDialog` as a presentational React component fed by the existing `UpdateState`. Add only an `onClose` UI callback, derive all visible variants from existing `phase` and `justUpdated` fields, and style the dialog with the existing plain CSS sheet. Do not modify Electron download, restart, or NSIS-install code.

**Tech Stack:** React 19, TypeScript, Vitest, existing plain CSS.

---

## File structure

- Modify: `src/app/App.tsx` — pass the dialog close callback and keep the existing updater actions unchanged.
- Modify: `src/app/components/UpdateDialog.tsx` — render the approved header, version summary, ready/success notices, scrollable release notes, and state-specific action bar.
- Modify: `src/app/components/UpdateDialog.test.tsx` — verify the ready and updated-success markup plus the retained download progress markup.
- Modify: `src/app/styles.css` — replace the compact dialog treatment with the approved modal hierarchy and responsive layout.

### Task 1: Specify the completed and successful views with tests

**Files:**
- Modify: `src/app/components/UpdateDialog.test.tsx`

- [ ] **Step 1: Add a failing ready-state assertion**

```tsx
expect(markup).toContain('v0.1.2 已就绪，重启后生效。');
expect(markup).toContain('立即重启');
expect(markup).toContain('稍后');
```

- [ ] **Step 2: Add a failing successful-update assertion**

```tsx
state={{ phase: 'idle', currentVersion: '0.1.2', justUpdated: true, releaseNotes: '修复视频预览' }}

expect(markup).toContain('🎉 更新成功！');
expect(markup).toContain('更新已完成，当前版本 v0.1.2');
expect(markup).toContain('我知道了');
```

- [ ] **Step 3: Run the focused component test**

Run: `npm test -- src/app/components/UpdateDialog.test.tsx`

Expected: FAIL because the current component does not render the ready banner or success layout.

### Task 2: Render the approved state-based dialog markup

**Files:**
- Modify: `src/app/components/UpdateDialog.tsx`

- [ ] **Step 1: Extend component props with the close callback**

```tsx
type Props = {
  state: UpdateState;
  onCheck(): void;
  onClose(): void;
  onDownload(): void;
  onOpenRelease(): void;
  onRestart(): void;
};
```

- [ ] **Step 2: Derive the text from the existing state only**

```tsx
const targetVersion = state.version ?? state.currentVersion;
const isSuccess = Boolean(state.justUpdated);
const isReady = state.phase === 'ready';
const summary = isSuccess
  ? `更新已完成，当前版本 v${state.currentVersion}`
  : `当前版本 v${state.currentVersion}，新版本已可用。`;
```

Use `currentVersion` as the source for the installed version and only render the summary when it is known; do not introduce a new updater IPC message for presentation-only text.

- [ ] **Step 3: Replace the compact header and body with the approved hierarchy**

```tsx
<header className="updateDialogHeader">
  <div className="updateDialogTitle">
    <span aria-hidden="true" className="updateDialogIcon">✣</span>
    <h2>{isSuccess ? '🎉 更新成功！' : '发现新版本'}</h2>
  </div>
  <button aria-label="关闭更新窗口" className="updateDialogClose" onClick={onClose} type="button">×</button>
</header>
```

Follow it with the version, summary, existing progress block, ready banner, `更新内容` heading, a scrollable release-note container, and the action bar. Render `稍后` with `onClose`; render `立即更新` only for `available`, `立即重启` only for `ready`, and `我知道了` only for `justUpdated`. Keep the existing error actions and custom progressbar semantics.

- [ ] **Step 4: Run the focused component test**

Run: `npm test -- src/app/components/UpdateDialog.test.tsx`

Expected: PASS with all update dialog tests green.

### Task 3: Connect the close control without changing updater behaviour

**Files:**
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Pass the existing visibility setter into the dialog**

```tsx
<UpdateDialog
  onCheck={() => void updater.check()}
  onClose={() => setShowUpdateDialog(false)}
  onDownload={() => void updater.download()}
  onOpenRelease={() => void updater.openRelease()}
  onRestart={() => void updater.restart()}
  state={updater.state}
/>
```

- [ ] **Step 2: Confirm no updater action changed**

Run: `npm test -- src/app/components/UpdateDialog.test.tsx electron/updater.test.ts`

Expected: PASS; the existing `updater:restart` path continues to call the same main-process restart method.

### Task 4: Apply the approved visual treatment

**Files:**
- Modify: `src/app/styles.css`

- [ ] **Step 1: Replace the compact dialog selectors**

```css
.updateDialog { width: min(660px, 100%); overflow: hidden; border: 1px solid #dbe5ef; border-radius: 20px; background: #fff; box-shadow: 0 28px 80px rgba(22, 38, 60, .32); }
.updateDialogHeader { display: flex; align-items: center; justify-content: space-between; min-height: 82px; padding: 22px 28px; border-bottom: 1px solid #e8edf3; }
.updateDialogNotes { max-height: 190px; overflow: auto; padding-right: 12px; white-space: pre-wrap; }
.updateReadyNotice { margin-top: 16px; border-radius: 9px; background: #e9f8ef; padding: 12px 14px; color: #16824c; }
```

Add the corresponding title, close-button, action-bar, progress, and narrow-screen rules using the existing blue (`#1769e0`) and green success colors. Keep modal contents inside the viewport using `max-height: calc(100vh - 40px)` and a scrollable body; do not resize the app shell or business pages.

- [ ] **Step 2: Run type checking and all tests**

Run: `npm test && npm run typecheck && git diff --check`

Expected: tests pass, TypeScript exits `0`, and Git reports no whitespace errors.

- [ ] **Step 3: Launch the local app and inspect the dialog**

Run: `npm run dev`

Expected: the approved dialog remains centered at normal browser zoom, release notes scroll within the modal, and each updater state presents the matching action labels.

- [ ] **Step 4: Commit the UI-only implementation**

```bash
git add src/app/App.tsx src/app/components/UpdateDialog.tsx src/app/components/UpdateDialog.test.tsx src/app/styles.css
git commit -m "feat: refine updater dialog UI"
```
