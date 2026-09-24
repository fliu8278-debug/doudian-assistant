import { describe, expect, it } from 'vitest';
import { newcomerGiftPageOptions } from './newcomerGift';

describe('新人礼金页面', () => {
  it('reuses the shop page instead of opening another tab', () => {
    expect(newcomerGiftPageOptions()).toEqual({ headless: false, newPage: false });
  });
});
