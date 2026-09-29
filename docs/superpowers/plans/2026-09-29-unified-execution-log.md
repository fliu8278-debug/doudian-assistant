# 全局执行记录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 左侧执行记录汇总六类任务，并保留各业务页面现有日志。

**Architecture:** 建券与新人礼金读取现有 SQLite 批次/任务；新建券批次保存类型。看后搜、抽帧从新任务开始写入一张轻量记录表。一个后端查询接口统一映射、排序；前端独立页面读取并展示。

**Tech Stack:** TypeScript, React, Express, Node SQLite, Vitest.

---

### Task 1: 持久记录数据

**Files:** `src/db/database.ts`, `src/db/couponTasks.ts`, `src/db/newcomerGiftTasks.ts`, `src/db/executionRecords.ts`, `src/db/executionRecords.test.ts`

- [x] 写失败测试：新建券保存 `fan/product/national` 类型；旧批次标 `legacy`；六类记录可按创建时间排序，失败消息保留中文。
- [x] 运行 `npx vitest run src/db/executionRecords.test.ts`，确认因缺失行为失败。
- [x] 为旧数据库迁移 `coupon_batches.kind`，新增非建券任务记录表；实现查询及最小写入函数。
- [x] 再运行同一测试，确认通过。

### Task 2: 接入任务写入与查询路由

**Files:** `src/server/couponQueue.ts`, `src/server/searchAfterViewQueue.ts`, `src/server/videoFrameExtraction.ts`, `src/server/app.ts`, `src/server/routes/executionRecords.ts`, `src/server/routes/executionRecords.test.ts`

- [x] 写失败测试：不同建券入口传正确类别；看后搜完成/失败、抽帧完成/失败写入并可查询；`GET /api/execution-records` 返回统一数据。
- [x] 运行定向 Vitest，确认因缺失行为失败。
- [x] 只在任务状态变更处写入摘要和事件，不修改 RPA 流程；注册路由。
- [x] 再运行定向 Vitest，确认通过。

### Task 3: 左侧页面

**Files:** `src/app/api.ts`, `src/app/App.tsx`, `src/app/pages/execution-records/ExecutionRecords.tsx`, `src/app/styles.css`, `src/app/pages/execution-records/ExecutionRecords.test.tsx`

- [x] 写失败测试：项目标签、今日/完成/运行/失败统计、展开子任务、刷新与中文错误显示。
- [x] 运行定向 Vitest，确认因缺失行为失败。
- [x] 增加独立页面替换左侧占位符，不改业务页面当前执行区域。
- [x] 再运行定向 Vitest，确认通过。

### Task 4: 验证

- [x] 运行 `npm test -- --testTimeout=15000` 与 `npm run typecheck`，确认退出码 0。
- [x] 运行 `npm run build`，确认退出码 0。
- [x] 检查差异只涉及全局记录，不运行真实建券任务，不推送和打包。
