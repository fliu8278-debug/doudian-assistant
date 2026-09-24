import { describe, expect, it } from 'vitest';
import { newcomerGiftTaskGapMs } from './newcomerGiftQueue';

describe('新人礼金队列', () => {
  it('uses a one-second gap between sequential tasks', () => {
    expect(newcomerGiftTaskGapMs()).toBe(1_000);
  });
});
