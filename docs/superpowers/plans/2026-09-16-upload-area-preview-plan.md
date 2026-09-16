# Upload-area video preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the selected source MP4 inside the existing upload area, while retaining the current output, progress and download workflow.

**Architecture:** Keep `VideoFrameRateWorkbench` state and upload handler unchanged. Its source card conditionally renders either the dashed upload target or the existing native video element. CSS reuses the current preview/player rules and adds only the source-player replacement control.

**Tech Stack:** React 19, TypeScript, CSS, Vitest.

---

### Task 1: Protect the compact source-card structure

**Files:**
- Modify: `src/app/App.test.tsx:15-63`

- [ ] **Step 1: Write the failing source-card expectation**

Replace the source-workspace expectations with checks that require the upload label and source-card class, retain the output-card check, and reject the removed file-row and metadata classes:

```tsx
expect(markup).toContain('上传 MP4 视频');
expect(markup).toContain('videoFrameUpload');
expect(markup).toContain('videoFrameOutputCard');
expect(markup).not.toContain('videoFrameFileRow');
expect(markup).not.toContain('videoFrameMetadata');
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run src/app/App.test.tsx`

Expected: FAIL because the existing markup renders the file-row and metadata grid and has no approved upload label.

- [ ] **Step 3: Commit the test change**

```powershell
git add src/app/App.test.tsx
git commit -m "test: cover compact source video area"
```

### Task 2: Replace the upload target with the selected source preview

**Files:**
- Modify: `src/app/App.tsx:352-410`
- Test: `src/app/App.test.tsx:15-63`

- [ ] **Step 1: Make the minimal conditional markup change**

Replace the standalone upload block, source-file row, preview block and metadata grid with one conditional block. The no-file branch retains the hidden MP4 file input and uses `上传 MP4 视频`; the selected-file branch keeps the existing metadata handler and player, with a button that opens `fileInputRef`:

```tsx
{sourceUrl ? (
  <div className="videoFramePreview videoFrameSourcePreview">
    <video
      className="videoFramePlayer"
      controls
      onLoadedMetadata={(event) => setMetadata({
        duration: event.currentTarget.duration,
        height: event.currentTarget.videoHeight,
        width: event.currentTarget.videoWidth
      })}
      src={sourceUrl}
    />
    <button className="videoFrameReplaceButton" onClick={() => fileInputRef.current?.click()} type="button">更换视频</button>
  </div>
) : (
  <div className="videoFrameUpload">
    <strong>上传 MP4 视频</strong>
    <span>点击或拖入文件</span>
    <input ref={fileInputRef} accept="video/mp4" className="hiddenInput" onChange={(event) => chooseVideo(event.target.files?.[0])} type="file" />
  </div>
)}
```

Do not change `chooseVideo`, processing state or API calls.

- [ ] **Step 2: Run the focused test to verify it passes**

Run: `npx vitest run src/app/App.test.tsx`

Expected: PASS with every `App.test.tsx` test green.

- [ ] **Step 3: Commit the implementation**

```powershell
git add src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: preview source video in upload area"
```

### Task 3: Match the approved compact layout

**Files:**
- Modify: `src/app/styles.css:496-662`
- Test: `src/app/App.test.tsx:15-63`

- [ ] **Step 1: Add only source-preview replacement styling**

Keep `.videoFrameUpload` as the empty-state dashed target. Add a positioned `.videoFrameSourcePreview` and a small `.videoFrameReplaceButton` at its top-right; remove rules solely used by `.videoFrameFileRow` and `.videoFrameMetadata`. Keep the shared `.videoFramePreview` aspect ratio and `.videoFramePlayer` behavior unchanged so the selected video exactly occupies the prior upload location.

- [ ] **Step 2: Run complete verification**

Run: `npm test; npm run typecheck; npm run build`

Expected: 16 test files / 50 tests pass, TypeScript exits 0, and the Vite/server build exits 0.

- [ ] **Step 3: Commit the visual change**

```powershell
git add src/app/styles.css src/app/App.test.tsx src/app/App.tsx
git commit -m "style: compact source video upload area"
```
