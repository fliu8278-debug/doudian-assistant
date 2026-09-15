import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from './couponQueue';

describe('coupon queue concurrency', () => {
  it('refills a free worker slot without waiting for the whole group', async () => {
    const events: string[] = [];
    let running = 0;
    let maxRunning = 0;

    await runWithConcurrency([1, 2, 3], 2, async (item) => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      events.push(`start-${item}`);
      await new Promise((resolve) => setTimeout(resolve, item === 2 ? 30 : 5));
      events.push(`end-${item}`);
      running -= 1;
    });

    expect(maxRunning).toBe(2);
    expect(events.indexOf('start-3')).toBeLessThan(events.indexOf('end-2'));
  });

  it('stops taking new work when the stop guard is set', async () => {
    const handled: number[] = [];
    let stopped = false;

    await runWithConcurrency([1, 2, 3], 1, async (item) => {
      handled.push(item);
      stopped = true;
    }, {
      shouldStop: () => stopped
    });

    expect(handled).toEqual([1]);
  });
});
