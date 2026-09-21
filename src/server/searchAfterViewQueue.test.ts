import { describe, expect, it } from 'vitest';
import { SearchAfterViewQueue } from './searchAfterViewQueue';

const submitted = (sku: string) => ({
  submitted: true,
  videoId: `video-${sku}`,
  sku,
  productIds: [`product-${sku}`],
  mainProductId: `product-${sku}`
});

describe('看后搜连续任务', () => {
  it('完成一条后持续执行下一条，直到没有待配置视频', async () => {
    const runs = ['232619', '216704', null];
    const queue = new SearchAfterViewQueue(async () => {
      const sku = runs.shift();
      return sku ? submitted(sku) : null;
    });

    const task = queue.start({ shopId: 'shop-1', keywords: ['斯凯奇男鞋'] });
    await queue.waitFor(task.id);

    expect(queue.get(task.id)).toMatchObject({
      status: 'complete',
      configured: 2,
      currentSku: '216704'
    });
  });

  it('暂停时立刻中断当前条，不把它记录为已提交', async () => {
    let abortSeen = false;
    const queue = new SearchAfterViewQueue(async (_input, signal) => {
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => {
        abortSeen = true;
        resolve();
      }, { once: true }));
      return submitted('232619');
    });

    const task = queue.start({ shopId: 'shop-1', keywords: ['斯凯奇男鞋'] });
    queue.pause(task.id);
    await queue.waitFor(task.id);

    expect(abortSeen).toBe(true);
    expect(queue.get(task.id)).toMatchObject({ status: 'paused', configured: 0 });
  });
});
