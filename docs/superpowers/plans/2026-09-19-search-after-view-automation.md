# 看后搜配置自动化流程实施记录

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 用同一个已登录店铺浏览器，自动完成“搜索运营 → 看后搜配置”的单条视频配置，并以提交动作完成作为成功标准。

**Architecture:** 复用 `openDoudianShopPage` 的持久浏览器上下文，只新建任务网页标签，不新建浏览器、不要求重新登录。所有页面动作集中在 `src/rpa/searchAfterView.ts`，UI/API 只传入店铺、款号（可选）、1–3 个搜索词和是否提交。

**Tech Stack:** TypeScript、Playwright、Vitest、抖店搜索运营页面。

---

## 固定流程

1. **打开页面**：使用已保存的店铺 profile 打开搜索运营页；失败时保留页面并返回原因。
2. **固定筛选**：选择配置状态“待配置”、配置区时间“近30天”、发布来源“全部自营账号”、是否挂车“全部”，点击“查询”，并校验下拉值。
3. **定位视频**：按表格顺序扫描待配置行；跳过没有 `六位款号-颜色码` 或缺少完整视频 ID 的行；如果传入款号，只处理匹配款号的行。
4. **选择商品**：点击“立即配置”，在“添加承接商品”中按款号搜索；勾选搜索结果里的每一条商品链接，包括国补链接，不按区间价或国补过滤。
5. **设置主推**：存在非国补商品时，将第一条非国补商品设为主推；只有国补时保留平台默认主推。
6. **填写搜索词**：写入 1–3 个自定义词，逐个回车，并验证每个词已显示为标签。
7. **提交与验收**：`autoSubmit=true` 时点击“立即提交”，等待提交按钮消失即返回成功；成功后只关闭本次任务网页，不关闭浏览器。平台后续显示“审核中”或“已优化”均不阻塞本次提交结果。

## 代码对应关系

- `applySearchAfterViewFilters`：第 2 步固定筛选与校验。
- `findTargetVideo`：第 3 步跳过无款号/无视频 ID 行。
- `selectSearchAfterViewProducts`：第 4 步全选商品链接。
- `chooseSearchAfterViewMainProduct` / `setMainProduct`：第 5 步主推规则。
- `fillSearchAfterViewKeywords`：第 6 步搜索词写入与显示校验。

## 已完成实现

- [x] 筛选条件固定为待配置、近30天、全部自营账号、挂车全部。
- [x] 商品搜索结果按商品 ID 去重并逐条勾选，保留国补链接。
- [x] 非国补优先主推；只有国补时不强行改主推。
- [x] 提交后等待提交按钮消失，确认提交动作完成。
- [x] 自动化失败不截图、不关闭失败页面，返回明确错误。

## 验证命令

```bash
npm run typecheck
npm test -- src/rpa/searchAfterView.test.ts
```

真实店铺验收时，页面必须满足：筛选栏显示“全部”、时间为“近30天”，并完成“立即提交”；“审核中”或“已优化”由平台后续处理。
