# 看后搜连续执行与立刻暂停 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让看后搜任务连续提交待配置视频，并可立刻停止当前浏览器动作。

**Architecture:** 复用现有抖店持久浏览器上下文；每个看后搜任务只打开一个独立任务页，并在该页连续配置。在服务端创建最小的内存任务管理器，使用 `AbortController` 关闭当前任务页；暂停接口等待页面关闭后返回，前端启动后轮询任务状态并调用暂停接口。

**Tech Stack:** TypeScript、Express、React、Playwright、Vitest。

---

### Task 1: 定义连续任务控制器

**Files:**
- Create: `src/server/searchAfterViewQueue.ts`
- Test: `src/server/searchAfterViewQueue.test.ts`

- [ ] 写失败测试：任务在成功回调后继续下一条，取消时停止循环并报告 `paused`。
- [ ] 运行 `npm test -- --run src/server/searchAfterViewQueue.test.ts`，确认测试因模块不存在而失败。
- [ ] 实现最小任务管理器：创建任务、保存状态、循环执行回调、`AbortController.abort()` 停止任务。
- [ ] 重跑相同测试，确认通过。

### Task 2: 让自动化支持中断与连续页面操作

**Files:**
- Modify: `src/rpa/searchAfterView.ts`
- Test: `src/rpa/searchAfterView.test.ts`

- [ ] 写失败测试：中断错误可识别为暂停，不被记为普通失败。
- [ ] 运行 `npm test -- --run src/rpa/searchAfterView.test.ts`，确认失败。
- [ ] 为自动化选项加入 `signal`，将暂停转为可识别的取消错误并关闭独立任务页；页面关闭后才报告暂停，提交后复用同一任务页继续下一次配置且保持店铺原有浏览器页。
- [ ] 重跑相同测试，确认通过。

### Task 3: 暴露启动、状态和暂停接口

**Files:**
- Modify: `src/server/routes/searchAfterView.ts`
- Create: `src/server/routes/searchAfterView.test.ts`

- [ ] 写失败测试：启动返回任务 ID，暂停接口返回 `paused`，状态接口可读取进度。
- [ ] 运行 `npm test -- --run src/server/routes/searchAfterView.test.ts`，确认失败。
- [ ] 将路由接入任务管理器，并为浏览器执行过程提供中断信号。
- [ ] 重跑相同测试，确认通过。

### Task 4: 增加界面暂停控制与执行状态

**Files:**
- Modify: `src/app/api.ts`
- Modify: `src/app/api.test.ts`
- Modify: `src/app/pages/search-after-view/SearchAfterViewWorkbench.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] 写失败测试：运行状态中显示“暂停任务”，暂停后显示“已暂停”。
- [ ] 运行 `npm test -- --run src/app/api.test.ts src/app/App.test.tsx`，确认失败。
- [ ] 实现启动、查询和暂停 API；页面轮询状态并显示当前款号、统计、日志和暂停按钮。
- [ ] 重跑相关测试，确认通过。

### Task 5: 完整验证与发布准备

- [ ] 运行 `npm test -- --run src/rpa/searchAfterView.test.ts src/server/searchAfterViewQueue.test.ts src/server/routes/searchAfterView.test.ts src/app/api.test.ts src/app/App.test.tsx`。
- [ ] 运行 `npm run typecheck` 与 `npm run build`。
- [ ] 在可见浏览器启动任务，确认成功提交一条后继续下一条；点击暂停后当前条不提交且页面显示已暂停。
