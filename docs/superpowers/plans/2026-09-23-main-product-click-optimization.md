# 设置主推点击优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将“设置主推”按钮的触发从 Playwright 动作点击改为按钮出现后的原生 DOM 点击，减少约 2.7 秒动作等待，同时保留成功确认。

**Architecture:** `src/rpa/searchAfterView.ts` 继续负责目标商品卡定位和成功提示轮询；仅调整 `clickSearchAfterViewMainProductButton` 的最小接口，使其等待可见后调用 locator 的 `evaluate` 执行 `HTMLElement.click()`。现有主推成功校验和所有其他流程保持不变。

**Tech Stack:** TypeScript、Playwright、Vitest。

---

### Task 1: 锁定原生点击行为

**Files:**
- Modify: `src/rpa/searchAfterView.test.ts`（主推按钮测试附近）
- Modify: `src/rpa/searchAfterView.ts:844-847`

- [ ] **Step 1: 写失败测试**

在现有 `clickSearchAfterViewMainProductButton` 测试旁新增一个 locator double，记录 `waitFor`、`evaluate` 和 `click` 调用，断言按钮可见后调用 `evaluate`，且不调用 `click`：

```ts
it('设置主推按钮出现后使用原生点击', async () => {
  const calls: string[] = [];
  const button = {
    waitFor: async () => { calls.push('waitFor'); },
    evaluate: async (fn: (element: HTMLElement) => void) => {
      calls.push('evaluate');
      fn(document.createElement('button'));
    },
    click: async () => { calls.push('click'); }
  };

  await clickSearchAfterViewMainProductButton(button);

  expect(calls).toEqual(['waitFor', 'evaluate']);
});
```

- [ ] **Step 2: 运行单测确认红灯**

运行：`npx vitest run src/rpa/searchAfterView.test.ts -t "设置主推按钮出现后使用原生点击"`

预期：FAIL，当前函数要求 `click`，没有 `evaluate` 行为。

- [ ] **Step 3: 写最小生产改动**

把 helper 的参数改为包含 `waitFor` 和 `evaluate`，保留可见等待，使用原生点击：

```ts
export async function clickSearchAfterViewMainProductButton(
  button: Pick<Locator, 'waitFor' | 'evaluate'>
) {
  await button.waitFor({ state: 'visible' });
  await button.evaluate((element) => {
    (element as HTMLElement).click();
  });
}
```

- [ ] **Step 4: 运行单测确认绿灯**

运行：`npx vitest run src/rpa/searchAfterView.test.ts -t "设置主推按钮出现后使用原生点击"`

预期：PASS。

- [ ] **Step 5: 运行相关回归验证**

运行：`npx vitest run src/rpa/searchAfterView.test.ts && npm run typecheck`

预期：测试全部通过，TypeScript 检查退出码为 0。

- [ ] **Step 6: 检查差异并提交**

运行：`git diff --check`，确认只有测试和 `src/rpa/searchAfterView.ts` 的目标改动；然后提交：

```bash
git add src/rpa/searchAfterView.ts src/rpa/searchAfterView.test.ts
git commit -m "perf: click main product without action wait"
```

## 自检

- 规格中的原生点击、成功确认和流程不变均由 Task 1 覆盖。
- 无新增依赖、无分页/搜索/提交改动。
- 失败测试先于生产代码改动执行。
