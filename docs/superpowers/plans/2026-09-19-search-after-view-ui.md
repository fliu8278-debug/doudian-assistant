# 看后搜配置 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a local, interactive “看后搜配置” workbench to the existing React app, including a 商品 sidebar entry, filter/list view, configuration drawer, keyword tags, and local submission state.

**Architecture:** Keep routing and navigation state in `src/app/App.tsx`, move the new workbench UI/state into a focused page component, and reuse the existing workspace/card/button styles from `styles.css` with feature-specific class names. The page uses local mock rows and React state only; it does not call the RPA or store real shop changes.

**Tech Stack:** React 19, TypeScript, existing CSS, Vitest static-markup tests, Vite.

---

### Task 1: Add the page route and sidebar entry

**Files:**
- Modify: `src/app/App.tsx`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: Write the failing test**

Add assertions that `<App />` contains “看后搜配置”, that `ensurePageGroupExpanded` opens the 商品 group for page `'searchAfterView'`, and that the new page component is exported/renderable.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run src/app/App.test.tsx -t "看后搜配置"`

Expected: FAIL because the page union, sidebar item, and component do not exist.

- [ ] **Step 3: Implement the route wiring**

Extend `Page` with `'searchAfterView'`, map it to `products` in `PAGE_GROUPS`, extend `NavIconName` and `NavIcon` with a small `searchAfterView` icon path, add a 商品 child button using `data-icon="searchAfterView"`, and render `<SearchAfterViewWorkbench currentShop={currentShop} />` in the main-page switch.

- [ ] **Step 4: Run the focused test**

Run: `npx vitest run src/app/App.test.tsx -t "看后搜配置"`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/app/App.tsx src/app/App.test.tsx && git commit -m "feat: add search-after-view navigation"`.

### Task 2: Build the local workbench and drawer interaction

**Files:**
- Create: `src/app/pages/search-after-view/SearchAfterViewWorkbench.tsx`
- Modify: `src/app/App.tsx`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: Write failing component tests**

Render `SearchAfterViewWorkbench` with no shop and assert the page title, filter labels, summary labels, first mock video, “立即配置”, and the three default keywords. Add a state test through `renderToStaticMarkup` only for initial markup; interaction behavior will be covered by the component’s event-safe structure and the build/type checks.

- [ ] **Step 2: Run the focused test**

Run: `npx vitest run src/app/App.test.tsx -t "搜索配置工作台"`

Expected: FAIL because the component and markup do not exist.

- [ ] **Step 3: Implement the component**

Create typed mock rows with fields `id`, `title`, `sku`, `videoId`, `publishedAt`, and `status`. Implement:

```tsx
const DEFAULT_KEYWORDS = ['斯凯奇纵云', '斯凯奇速锋', '斯凯奇男鞋'];
const MOCK_PRODUCTS = [
  { id: '3843562213268914719', title: '【国补】斯凯奇闪穿鞋秋季男子一脚蹬健步鞋厚底老人鞋爸爸鞋211085', subsidy: true },
  { id: '3827780832781795719', title: '斯凯奇男鞋2026夏季闪穿一脚蹬健步鞋透气轻弹网面休闲鞋211085', subsidy: false },
  { id: '3827209481712959517', title: '斯凯奇闪穿鞋夏季男子一脚蹬网面轻便透气健步鞋厚底休闲鞋211085', subsidy: false },
  { id: '3796235244974244275', title: '【透气网鞋】斯凯奇闪穿鞋夏季男子一脚蹬健步鞋厚底休闲鞋211085', subsidy: false }
];
```

Use `useState` for selected row, drawer visibility, search text, selected product IDs, keyword text, keyword tags, and row status. The drawer must render all four products checked by default, label the first product “国补”, mark the second product “主推品”, allow editing/removing/adding up to three keyword tags, and on submit set the row status to `审核中`, close the drawer, and append a local success message.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npx vitest run src/app/App.test.tsx -t "搜索配置工作台" && npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

Run: `git add src/app/pages/search-after-view/SearchAfterViewWorkbench.tsx src/app/App.tsx src/app/App.test.tsx && git commit -m "feat: add search-after-view workbench"`.

### Task 3: Match the existing UI and verify the complete build

**Files:**
- Modify: `src/app/styles.css`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: Add feature styles**

Add only scoped classes for `.searchAfterViewPage`, `.searchAfterViewFilters`, `.searchAfterViewSummary`, `.searchAfterViewTable`, `.searchAfterViewDrawer`, `.searchAfterViewProduct`, `.searchAfterViewKeywordTags`, and responsive rules at the existing breakpoints. Reuse existing colors, border radii, button classes, and workspace spacing.

- [ ] **Step 2: Add markup assertions**

Assert that the rendered page includes the scoped class names, “全部自营账号”, “是否挂车”, “国补”, “主推品”, and “审核中”.

- [ ] **Step 3: Run the full verification**

Run: `npm run typecheck && npm test -- --run && npm run build`

Expected: TypeScript passes, all Vitest tests pass, and Vite/server builds complete successfully.

- [ ] **Step 4: Commit**

Run: `git add src/app/styles.css src/app/App.test.tsx && git commit -m "style: polish search-after-view workbench"`.

### Task 4: Open the local UI preview

**Files:**
- No source changes.

- [ ] **Step 1: Start the existing local dev server**

Run: `npm run dev:web -- --host 127.0.0.1 --port 5173` if the server is not already running.

- [ ] **Step 2: Open the preview**

Open `http://127.0.0.1:5173/`, navigate to 商品 → 看后搜配置, and verify the list, drawer, keyword tags, product labels, and local “审核中” transition.
