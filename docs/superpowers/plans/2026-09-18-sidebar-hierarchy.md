# 侧栏一级/二级菜单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将侧栏四个功能分组改为可折叠的一级菜单与二级入口，并保存展开状态。

**Architecture:** 在 `App.tsx` 中维护四个分组的展开状态，使用原生 `localStorage` 持久化；当前页面所属分组在页面切换时自动展开。现有页面状态、按钮处理和 SVG 图标不变，只调整导航结构与 CSS。

**Tech Stack:** React 19、TypeScript、现有 CSS、Vitest。

---

### Task 1: Add failing navigation tests

**Files:**
- Modify: `src/app/App.test.tsx`

- [ ] Add assertions that rendered `App` contains four expandable group buttons, nested child navigation markers, and the active group remains expanded.
- [ ] Add a pure helper test for a group-state updater that opens the group containing the selected page.
- [ ] Run `npm test -- --run src/app/App.test.tsx` and confirm the new expectations fail before implementation.

### Task 2: Implement collapsible group state

**Files:**
- Modify: `src/app/App.tsx`

- [ ] Add a `NavGroupName` union and `NAV_GROUP_PAGES` mapping for `shops/accountStatus`, coupon pages, product tools, and video tools.
- [ ] Add `readSidebarGroups`, `writeSidebarGroups`, and `ensurePageGroupExpanded` helpers using guarded `localStorage` access.
- [ ] Add `expandedGroups` state initialized to all groups open, then restored from storage when available.
- [ ] Ensure every `setPage` path opens its parent group before changing page.
- [ ] Render each group label as a button with `aria-expanded`, a chevron icon, and children wrapped in a nested container that is hidden when collapsed.

### Task 3: Match existing visual language

**Files:**
- Modify: `src/app/styles.css`

- [ ] Reuse existing sidebar colors and spacing; add only group toggle, chevron rotation, and child indentation styles.
- [ ] Preserve active child styling and footer layout.

### Task 4: Verify and finish

**Files:**
- No additional source files.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Inspect the final diff and report changed files without pushing GitHub.
