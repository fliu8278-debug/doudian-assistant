import { describe, expect, it } from 'vitest';
import { SearchAfterViewQueue } from './searchAfterViewQueue';
import { SearchAfterViewRowError } from '../rpa/searchAfterView';

const submitted = (sku: string) => ({
  submitted: true,
  videoId: `video-${sku}`,
  sku,
  productIds: [`product-${sku}`],
  mainProductId: `product-${sku}`
});

describe('看后搜连续任务', () => {
  it('完成一条后持续执行下一条，直到没有待配置视频', async () => {
    const runs = ['232619', '216704', '232705', null];
    const queue = new SearchAfterViewQueue(async () => {
      const sku = runs.shift();
      return sku ? submitted(sku) : null;
    });

    const task = queue.start({ shopId: 'shop-1', keywords: ['斯凯奇男鞋'] });
    await queue.waitFor(task.id);

    expect(queue.get(task.id)).toMatchObject({
      status: 'complete',
      configured: 3,
      currentSku: '232705'
    });
  });

  it('开始配置时立即公开当前视频 ID 和款号', async () => {
    let releaseCurrent: (() => void) | undefined;
    const current = new Promise<void>((resolve) => { releaseCurrent = resolve; });
    const queue = new SearchAfterViewQueue(async (_input, _signal, onTarget) => {
      onTarget?.({ videoId: 'video-232619', sku: '232619' });
      await current;
      return null;
    });

    const task = queue.start({ shopId: 'shop-1', keywords: ['斯凯奇男鞋'] });
    await Promise.resolve();
    expect(queue.get(task.id)).toMatchObject({
      status: 'running',
      currentVideoId: 'video-232619',
      currentSku: '232619'
    });

    releaseCurrent?.();
    await queue.waitFor(task.id);
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

  it('暂停接口等待当前浏览器动作退出后才返回已暂停', async () => {
    let finishCurrentAction: (() => void) | undefined;
    const queue = new SearchAfterViewQueue(async (_input, signal) => {
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => {
        finishCurrentAction = resolve;
      }, { once: true }));
      return null;
    });

    const task = queue.start({ shopId: 'shop-1', keywords: ['斯凯奇男鞋'] });
    const pausing = queue.pause(task.id);
    expect(pausing).toBeInstanceOf(Promise);

    let returned = false;
    void Promise.resolve(pausing).then(() => { returned = true; });
    await Promise.resolve();
    expect(returned).toBe(false);

    finishCurrentAction?.();
    await pausing;
    expect(queue.get(task.id)).toMatchObject({ status: 'paused', configured: 0 });
  });

  it('同一店铺已有任务运行时复用该任务，避免两个浏览器流程并发', async () => {
    const queue = new SearchAfterViewQueue(async (_input, signal) => {
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
      return null;
    });

    const first = queue.start({ shopId: 'shop-1', keywords: ['斯凯奇男鞋'] });
    const second = queue.start({ shopId: 'shop-1', keywords: ['斯凯奇男鞋'] });
    queue.pause(first.id);
    await queue.waitFor(first.id);

    expect(second.id).toBe(first.id);
  });

  it('跳过配置失败的视频后继续处理下一条', async () => {
    const skippedByRun: string[][] = [];
    let attempts = 0;
    const queue = new SearchAfterViewQueue(async (input) => {
      skippedByRun.push(input.skippedVideoIds ?? []);
      attempts += 1;
      if (attempts === 1) throw new SearchAfterViewRowError('video-bad', '商品选择失败');
      return attempts === 2 ? submitted('216704') : null;
    });

    const task = queue.start({ shopId: 'shop-1', keywords: ['斯凯奇男鞋'] });
    await queue.waitFor(task.id);

    expect(queue.get(task.id)).toMatchObject({ status: 'complete', configured: 1, errors: 1 });
    expect(skippedByRun).toEqual([[], ['video-bad'], ['video-bad', 'video-216704']]);
  });
});
