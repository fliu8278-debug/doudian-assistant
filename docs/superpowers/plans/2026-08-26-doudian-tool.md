# Doudian Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a local Doudian shop tool with shop list UI, SQLite persistence, and a clear structure for later coupon RPA.

**Architecture:** React renders the local tool UI. Express exposes local JSON APIs. SQLite stores shops, browser profile paths, coupon batches, tasks, logs, and settings. RPA code is isolated so page-selector issues are easy to locate later.

**Tech Stack:** React, TypeScript, Vite, Express, Node 24 `node:sqlite`, Playwright, Vitest.

---

### Task 1: Project Skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`

- [ ] Add scripts for dev, server, web, typecheck, test, and build.
- [ ] Install React, Express, Playwright, and TypeScript tooling.

### Task 2: Database Foundation

**Files:**
- Create: `src/db/database.ts`
- Create: `src/db/shops.ts`
- Create: `src/db/database.test.ts`
- Create: `src/shared/types.ts`

- [ ] Write failing tests for schema creation and shop insertion.
- [ ] Implement SQLite initialization and shop repository functions.
- [ ] Re-run tests until they pass.

### Task 3: Coupon Row Validation

**Files:**
- Create: `src/imports/couponRows.ts`
- Create: `src/imports/couponRows.test.ts`

- [ ] Write failing tests for valid rows and missing required fields.
- [ ] Implement row normalization and validation.
- [ ] Re-run tests until they pass.

### Task 4: Local API

**Files:**
- Create: `src/server/index.ts`
- Create: `src/server/routes/shops.ts`
- Create: `src/server/routes/health.ts`

- [ ] Add health endpoint.
- [ ] Add shop list, create shop, set current shop, and mark login-needed endpoints.
- [ ] Keep API local and JSON-only for the first version.

### Task 5: Frontend Shop List

**Files:**
- Create: `src/app/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/styles.css`
- Create: `src/app/pages/shops/ShopList.tsx`
- Create: `src/app/api.ts`

- [ ] Build the sidebar structure: shop management, tools, other, settings.
- [ ] Build shop list cards/table with status, current shop, open backend, relogin, and set-current buttons.
- [ ] Keep the coupon workbench visible as the first tool screen.

### Task 6: RPA Placeholders

**Files:**
- Create: `src/rpa/browser.ts`
- Create: `src/rpa/doudian.ts`
- Create: `src/rpa/coupon/fanCoupon.ts`
- Create: `src/rpa/coupon/selectors.ts`

- [ ] Add typed function boundaries only.
- [ ] Do not implement final coupon submit automation in this slice.

### Task 7: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Start the dev server and open the local UI.
