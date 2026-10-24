import { afterEach, describe, expect, it, vi } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';

const { openDoudianShopPage, fillDoudianDateTimeRange } = vi.hoisted(() => ({
  openDoudianShopPage: vi.fn(),
  fillDoudianDateTimeRange: vi.fn()
}));

vi.mock('./doudianSession', () => ({ openDoudianShopPage }));
vi.mock('./coupon/timePicker', () => ({ fillDoudianDateTimeRange }));

import { closeFailedNewcomerGiftPage, closeSubmittedPage, newcomerGiftPageOptions, submitNewcomerGift, submitNewcomerGiftTask, waitForSubmitJump } from './newcomerGift';

let browser: Browser | undefined;

afterEach(async () => {
  await browser?.close();
  browser = undefined;
  openDoudianShopPage.mockReset();
  fillDoudianDateTimeRange.mockReset();
});

describe('新人礼金页面', () => {
  it('搜索款号明确无结果时关闭建券页并返回已跳过', async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(`
      <input id="activity_name" />
      <div id="auto_renewal"><label><input type="radio" checked />不开启</label></div>
      <div id="participate_type"><label><input type="radio" checked />指定商品</label></div>
      <div id="deduction_discount_type"><label><input type="radio" checked />不开启</label></div>
      <button>添加商品</button>
      <input class="ecom-mcenter-input-tag-input" />
      <button class="index-searchBtn--zzy7W" onclick="document.querySelector('#empty').hidden = false">搜索</button>
      <div id="empty" hidden>暂无数据</div>
    `);
    openDoudianShopPage.mockResolvedValue({ page });

    await expect(submitNewcomerGiftTask({} as Parameters<typeof submitNewcomerGiftTask>[0], {
      shopId: 'shop', activityName: '113821', productSearchKeyword: '113821',
      startTime: '2026-10-24 00:00:00', endTime: '2026-11-14 23:59:59', discountAmount: 5
    })).resolves.toMatchObject({ submitted: false, skipped: true, message: expect.stringContaining('113821') });
    expect(page.isClosed()).toBe(true);
    expect(context.pages()).toHaveLength(1);
  }, 25_000);

  it('弹窗初始暂无数据但搜索后出现商品时不能误跳过', async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(`
      <input id="activity_name" />
      <div id="auto_renewal"><label><input type="radio" checked />不开启</label></div>
      <div id="participate_type"><label><input type="radio" checked />指定商品</label></div>
      <div id="deduction_discount_type"><label><input type="radio" checked />不开启</label></div>
      <button>添加商品</button>
      <input class="ecom-mcenter-input-tag-input" />
      <button class="index-searchBtn--zzy7W" onclick="setTimeout(() => { document.querySelector('#results').innerHTML = '<tr><td><input type=checkbox></td><td>216704 ¥299</td></tr>'; }, 50)">搜索</button>
      <table id="results"><tr><td>暂无数据</td></tr></table>
      <button>确定</button>
    `);
    openDoudianShopPage.mockResolvedValue({ page });

    await expect(submitNewcomerGiftTask({} as Parameters<typeof submitNewcomerGiftTask>[0], {
      shopId: 'shop', activityName: '216704', productSearchKeyword: '216704',
      startTime: '2026-10-24 00:00:00', endTime: '2026-11-14 23:59:59', discountAmount: 5
    })).rejects.toThrow('没有找到商品优惠金额输入框');
    expect(await page.locator('#results input[type="checkbox"]').isChecked()).toBe(true);
  });

  it('有可选商品但勾选失败时不能记为已跳过', async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(`
      <input id="activity_name" />
      <div id="auto_renewal"><label><input type="radio" checked />不开启</label></div>
      <div id="participate_type"><label><input type="radio" checked />指定商品</label></div>
      <div id="deduction_discount_type"><label><input type="radio" checked />不开启</label></div>
      <button>添加商品</button>
      <input class="ecom-mcenter-input-tag-input" />
      <button class="index-searchBtn--zzy7W">搜索</button>
      <table><tr><td><input type="checkbox" onclick="event.preventDefault()"></td><td>216704 ¥299</td></tr></table>
      <button>确定</button>
    `);
    openDoudianShopPage.mockResolvedValue({ page });

    await expect(submitNewcomerGiftTask({} as Parameters<typeof submitNewcomerGiftTask>[0], {
      shopId: 'shop', activityName: '216704', productSearchKeyword: '216704',
      startTime: '2026-10-24 00:00:00', endTime: '2026-11-14 23:59:59', discountAmount: 5
    })).rejects.toThrow('商品勾选失败');
    expect(page.isClosed()).toBe(false);
  });

  it.each([
    ['disappears after the first click', 'after-first-click', 1],
    ['disappears while waiting to retry', 'during-retry-wait', 1],
    ['remains visible for the second click', 'after-second-click', 2]
  ])('waits for the success jump when the submit button %s', async (_label, disappearWhen, expectedClicks) => {
    let url = 'https://fxg.jinritemai.com/ffa/marketing/union/allowance/create';
    let buttonVisible = true;
    let clickCount = 0;
    const footerButton = {
      filter: () => footerButton,
      first: () => footerButton,
      isVisible: vi.fn(async () => buttonVisible),
      scrollIntoViewIfNeeded: vi.fn(async () => undefined),
      boundingBox: vi.fn(async () => buttonVisible ? { x: 0, y: 0, width: 20, height: 20 } : null)
    };
    const confirmButton = { last: () => confirmButton, isVisible: vi.fn(async () => false) };
    const page = {
      locator: vi.fn((selector: string) => selector.includes('index-footer') ? footerButton : { getByRole: () => confirmButton }),
      getByRole: vi.fn(() => ({ all: async () => [] })),
      getByText: vi.fn(() => ({ count: async () => 0 })),
      mouse: { click: vi.fn(async () => {
        clickCount += 1;
        if (disappearWhen === 'after-first-click' || clickCount === 2) buttonVisible = false;
      }) },
      waitForTimeout: vi.fn(async (ms: number) => {
        if (ms === 500 && disappearWhen === 'during-retry-wait') buttonVisible = false;
      }),
      waitForURL: vi.fn(async () => { url = 'https://fxg.jinritemai.com/ffa/marketing/union/allowance/home'; }),
      waitForLoadState: vi.fn(async () => undefined),
      url: () => url
    } as unknown as Page;

    await expect(submitNewcomerGift(page)).resolves.toBeUndefined();
    expect(page.mouse.click).toHaveBeenCalledTimes(expectedClicks);
  });

  it('reuses the shop page instead of opening another tab', () => {
    expect(newcomerGiftPageOptions()).toEqual({ headless: false, newPage: false });
  });

  it('uses the successful page jump without requiring the destination load to finish', async () => {
    const waitForLoadState = vi.fn().mockRejectedValue(new Error('destination still loading'));
    const page = {
      url: () => 'https://fxg.jinritemai.com/ffa/marketing/union/allowance/list',
      waitForURL: vi.fn().mockResolvedValue(undefined),
      waitForLoadState,
      close: vi.fn()
    } as unknown as Page;

    expect(await waitForSubmitJump(page)).toBe(true);
    expect(waitForLoadState).not.toHaveBeenCalled();
  });

  it('keeps the page open when the destination has not loaded', async () => {
    const close = vi.fn();
    const page = {
      isClosed: () => false,
      waitForLoadState: vi.fn().mockRejectedValue(new Error('destination still loading')),
      close
    } as unknown as Page;

    await expect(closeSubmittedPage(page)).resolves.toBeUndefined();
    expect(close).not.toHaveBeenCalled();
  });

  it('keeps the form open when submission fails', async () => {
    const close = vi.fn();
    await closeFailedNewcomerGiftPage({ close } as unknown as Page, true);
    expect(close).not.toHaveBeenCalled();
  });

  it('keeps the form open when filling fails before submission', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const bringToFront = vi.fn().mockResolvedValue(undefined);
    await closeFailedNewcomerGiftPage({ close, bringToFront } as unknown as Page, false);
    expect(close).not.toHaveBeenCalled();
    expect(bringToFront).toHaveBeenCalledTimes(1);
  });

  it('keeps the persistent shop window alive after closing the completed page', async () => {
    const close = vi.fn();
    const newPage = vi.fn();
    const page = {
      isClosed: () => false,
      waitForLoadState: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockImplementation(close),
      context: () => ({ pages: () => [], newPage })
    } as unknown as Page;

    await closeSubmittedPage(page);

    expect(close).toHaveBeenCalledWith({ runBeforeUnload: false });
    expect(newPage).toHaveBeenCalledTimes(1);
  });
});
