# Unified Workspace Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every existing sidebar entry an independent, consistent desktop-workspace page while keeping existing shop and marketing behavior intact.

**Architecture:** Retain the single React application shell and existing page workbenches. Expand the page identifier and navigation targets in `App.tsx`, add a small reusable static workspace page for UI-only tools, then use scoped CSS classes for the shared content frame and the video-specific 16:9 layout. Existing shop, coupon, and newcomer-gift workflows remain in place.

**Tech Stack:** React, TypeScript, Vitest, vanilla CSS, Vite.

---

### Task 1: Cover the unified navigation and static workspace pages

**Files:**
- Modify: `src/app/App.tsx:9-166`
- Modify: `src/app/App.test.tsx:5-31`

- [ ] **Step 1: Add a failing static-render assertion for the new independent pages**

```tsx
it('renders independent workspace content for every navigation section', () => {
  const markup = renderToStaticMarkup(<App />);

  expect(markup).toContain('账号状态');
  expect(markup).toContain('商品搜索');
  expect(markup).toContain('标题检查');
  expect(markup).toContain('表格模板');
  expect(markup).toContain('执行记录');
});
```

- [ ] **Step 2: Run the test to verify the existing app does not render all page content**

Run: `npm test -- src/app/App.test.tsx`

Expected: the assertion is initially insufficient to prove page switching because the navigation buttons do not own distinct pages.

- [ ] **Step 3: Extend the page union and route every sidebar button to a distinct page**

Add all static-layout identifiers alongside the existing pages:

```tsx
type Page =
  | 'shops'
  | 'accountStatus'
  | 'coupon'
  | 'newcomerGift'
  | 'productSearch'
  | 'titleCheck'
  | 'videoFrameExtraction'
  | 'tableTemplates'
  | 'executionRecords';
```

Use `setPage(...)` for each navigation entry. Render `WorkspacePlaceholder` only for the UI-only entries, passing the title, breadcrumb, description, primary action label, summary labels, and empty-state copy. Do not place a video tool, shop table, or marketing task inside an unrelated page.

- [ ] **Step 4: Render a minimal workspace placeholder with a common page header**

Implement a local component in `src/app/App.tsx` with this contract:

```tsx
function WorkspacePlaceholder(props: {
  breadcrumb: string;
  title: string;
  description: string;
  actionLabel: string;
  summary: Array<{ label: string; value: string }>;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <div className="workspacePage">
      <div className="workspaceBreadcrumb">{props.breadcrumb}</div>
      <header className="workspaceHeader">...</header>
      <section className="workspaceSummary">...</section>
      <section className="workspaceCard workspaceEmptyState">...</section>
    </div>
  );
}
```

Keep buttons `type="button"`; they remain visual placeholders until their underlying business feature exists.

- [ ] **Step 5: Re-run the component test**

Run: `npm test -- src/app/App.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the navigation slice**

```bash
git add src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: add unified workspace navigation"
```

### Task 2: Apply the shared workspace layout without altering working flows

**Files:**
- Modify: `src/app/styles.css:56-345`
- Modify: `src/app/styles.css:1020-1575`
- Modify: `src/app/pages/shops/ShopList.tsx:92-177`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: Add a failing class-presence assertion for the shop workspace frame**

```tsx
it('keeps the shop list inside the shared workspace frame', () => {
  const markup = renderToStaticMarkup(<App />);
  expect(markup).toContain('workspacePage');
  expect(markup).toContain('workspaceHeader');
});
```

- [ ] **Step 2: Run the test before changing the shop component**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because `ShopList` only uses `shopsHero`.

- [ ] **Step 3: Wrap the shop page in the common content structure**

Replace the outer shop hero fragment with the following hierarchy while retaining all current buttons, rows, dialogs, API calls, and event handlers:

```tsx
<div className="workspacePage shopsWorkspace">
  <div className="workspaceBreadcrumb">店铺 / 店铺列表</div>
  <div className="shopsHero workspaceHeader">...</div>
  <section className="shopStatusStrip">...</section>
  <section className="shopRowsPanel workspaceCard">...</section>
</div>
```

- [ ] **Step 4: Add the shared CSS primitives and align existing page headers**

Add CSS for `.workspacePage`, `.workspaceBreadcrumb`, `.workspaceHeader`, `.workspaceSummary`, `.workspaceCard`, and `.workspaceEmptyState`. Apply the same reading-width, padding, border, radius, heading, and data-number rules to `.shopsWorkspace`, `.couponGrid`, `.couponSettingsPanel`, and `.videoFramePage`. Keep `.app-shell` at `100dvh`, keep body scroll disabled, and preserve inner scrolling only.

- [ ] **Step 5: Re-run the component test and build**

Run: `npm test -- src/app/App.test.tsx && npm run build`

Expected: PASS; Vite may retain its non-blocking large-chunk warning.

- [ ] **Step 6: Commit the shared-frame slice**

```bash
git add src/app/App.tsx src/app/pages/shops/ShopList.tsx src/app/styles.css src/app/App.test.tsx
git commit -m "style: unify workspace page layout"
```

### Task 3: Repair the video workbench hierarchy and preview proportions

**Files:**
- Modify: `src/app/App.tsx:224-325`
- Modify: `src/app/styles.css:332-671`
- Modify: `src/app/App.test.tsx:16-31`

- [ ] **Step 1: Add failing assertions for separate video cards and 16:9 previews**

```tsx
it('renders separated 16 by 9 video input and output cards', () => {
  const markup = renderToStaticMarkup(<VideoFrameRateWorkbench />);
  expect(markup).toContain('videoFrameSourceCard');
  expect(markup).toContain('videoFrameOutputCard');
  expect(markup).toContain('videoFramePreview');
});
```

- [ ] **Step 2: Run the test to verify the old class names do not satisfy the new hierarchy**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because the source and output sections only use the old panel classes.

- [ ] **Step 3: Add explicit source/output card and preview class names**

Use these class names without changing the video state machine, selected file behavior, progress timers, or download behavior:

```tsx
<section className="workspaceCard videoFrameSourceCard" ...>
  ...
  <div className="videoFramePreview">...
  </div>
</section>

<section className="workspaceCard videoFrameOutputCard" ...>
  <div className="videoFramePreview videoFrameOutputPreview">...</div>
  <section className="videoFrameProgress" ...>...</section>
</section>
```

- [ ] **Step 4: Make preview dimensions normal and independent of panel height**

Replace viewport-based fixed player heights with:

```css
.videoFramePreview {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: 9px;
  background: #161d27;
}

.videoFramePreview .videoFramePlayer {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}
```

Add a single-gap layout for the output card so its preview, progress block, output information, and status cannot overlap. On desktop, make the source and output cards share the available height; under the existing narrow-screen breakpoint stack them and allow the main content to scroll internally.

- [ ] **Step 5: Re-run the video test and build**

Run: `npm test -- src/app/App.test.tsx && npm run build && git diff --check`

Expected: PASS with no whitespace errors.

- [ ] **Step 6: Commit the video slice**

```bash
git add src/app/App.tsx src/app/styles.css src/app/App.test.tsx
git commit -m "style: organize video frame workspace"
```

### Task 4: Verify navigation, responsiveness, and all implemented flows

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/app/styles.css:2304-2448`

- [ ] **Step 1: Add final static-render coverage for the sidebar labels and workspace content**

```tsx
it('keeps every sidebar group and its matching workspace content available', () => {
  const markup = renderToStaticMarkup(<App />);
  ['店铺', '营销', '商品', '视频', '记录', '设置'].forEach((label) => {
    expect(markup).toContain(label);
  });
  expect(markup).toContain('店铺管理');
});
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`

Expected: all Vitest test files PASS.

- [ ] **Step 3: Build the production client and server and inspect whitespace errors**

Run: `npm run build && git diff --check`

Expected: type check and build PASS; no whitespace errors.

- [ ] **Step 4: Manually check the local preview at `http://127.0.0.1:5173`**

Verify at desktop width that the browser does not show a global scrollbar, each sidebar item leads to its own page, and the video players are 16:9 with visible spacing before progress. Verify at a narrow width that the sidebar hides, content stacks, and the main area scrolls internally.

- [ ] **Step 5: Commit final verification changes**

```bash
git add src/app/App.test.tsx src/app/styles.css
git commit -m "test: cover unified workspace layout"
```
