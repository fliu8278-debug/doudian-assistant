import { describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright';
import { closeSubmittedPage, newcomerGiftPageOptions, waitForSubmitJump } from './newcomerGift';

describe('新人礼金页面', () => {
  it('reuses the shop page instead of opening another tab', () => {
    expect(newcomerGiftPageOptions()).toEqual({ headless: false, newPage: false });
  });

  it('waits for the destination to load even when the URL changed before the check', async () => {
    const waitForLoadState = vi.fn().mockResolvedValue(undefined);
    const page = {
      url: () => 'https://fxg.jinritemai.com/ffa/marketing/union/allowance/list',
      waitForURL: vi.fn().mockResolvedValue(undefined),
      waitForLoadState,
      close: vi.fn()
    } as unknown as Page;

    expect(await waitForSubmitJump(page)).toBe(true);
    expect(waitForLoadState).toHaveBeenCalledWith('load', { timeout: 12_000 });
  });

  it('keeps the page open when the destination has not loaded', async () => {
    const close = vi.fn();
    const page = {
      isClosed: () => false,
      waitForLoadState: vi.fn().mockRejectedValue(new Error('destination still loading')),
      close
    } as unknown as Page;

    await expect(closeSubmittedPage(page)).rejects.toThrow('destination still loading');
    expect(close).not.toHaveBeenCalled();
  });
});
