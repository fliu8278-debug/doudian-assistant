import { describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright';
import { closeFailedNewcomerGiftPage, closeSubmittedPage, newcomerGiftPageOptions, submitNewcomerGift, waitForSubmitJump } from './newcomerGift';

describe('新人礼金页面', () => {
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
