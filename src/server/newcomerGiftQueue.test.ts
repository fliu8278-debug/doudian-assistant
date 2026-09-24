import { describe, expect, it } from 'vitest';
import { newcomerGiftTaskGapMs, newcomerGiftWorkerCount } from './newcomerGiftQueue';

describe('新人礼金队列', () => {
  it('uses a one-second gap between sequential tasks', () => {
    expect(newcomerGiftTaskGapMs()).toBe(1_000);
  });

  it('runs one task at a time even when the request asks for more workers', () => {
    expect(newcomerGiftWorkerCount(5)).toBe(1);
  });
});
