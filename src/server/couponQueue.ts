import {
  createCouponBatch,
  getCouponBatch,
  listPendingCouponTasks,
  stopPendingCouponTasks,
  updateCouponBatchStatus,
  updateCouponTaskStatus
} from '../db/couponTasks';
import { getShopAuthStorage } from '../db/shops';
import { submitFanCouponTask } from '../rpa/coupon/fanCoupon';
import type { CouponBatch, CouponRow } from '../shared/types';
import type { AppDatabase } from '../db/database';

const runningBatches = new Set<string>();
const cancelledBatches = new Set<string>();
const DEFAULT_COUPON_WORKER_CONCURRENCY = 1;
const COUPON_TASK_TIMEOUT_MS = 90_000;
const COUPON_TASK_GAP_MS = 2_000;

export function enqueueCouponBatch(
  db: AppDatabase,
  input: {
    shopId: string;
    fileName: string;
    rows: CouponRow[];
    concurrency?: number;
  }
) {
  const batch = createCouponBatch(db, input);
  if (!batch) throw new Error('创建优惠券任务失败');
  cancelledBatches.delete(batch.id);
  void runCouponBatch(db, batch.id, input.concurrency ?? DEFAULT_COUPON_WORKER_CONCURRENCY);
  return batch;
}

export function cancelCouponBatch(db: AppDatabase, batchId: string) {
  cancelledBatches.add(batchId);
  stopPendingCouponTasks(db, batchId, '已停止');
  updateCouponBatchStatus(db, batchId, finalBatchStatus(getCouponBatch(db, batchId)));
  return getCouponBatch(db, batchId);
}

async function runCouponBatch(db: AppDatabase, batchId: string, concurrency: number) {
  if (runningBatches.has(batchId)) return;
  runningBatches.add(batchId);
  updateCouponBatchStatus(db, batchId, 'running');

  try {
    const batch = getCouponBatch(db, batchId);
    if (!batch) throw new Error('优惠券批次不存在');
    const profile = getShopAuthStorage(db, batch.shopId);

    await runWithConcurrency(
      listPendingCouponTasks(db, batchId),
      concurrency,
      (task) => runCouponTask(db, batch.shopId, profile, task),
      {
        delayMs: COUPON_TASK_GAP_MS,
        shouldStop: () => cancelledBatches.has(batchId)
      }
    );

    updateCouponBatchStatus(db, batchId, finalBatchStatus(getCouponBatch(db, batchId)));
  } catch (caught) {
    failPendingCouponTasks(db, batchId, caught instanceof Error ? caught.message : '建券批次失败');
    updateCouponBatchStatus(db, batchId, 'failed');
  } finally {
    runningBatches.delete(batchId);
    cancelledBatches.delete(batchId);
  }
}

function failPendingCouponTasks(db: AppDatabase, batchId: string, message: string) {
  for (const task of listPendingCouponTasks(db, batchId)) {
    updateCouponTaskStatus(db, task.id, 'failed', message);
  }
}

async function runCouponTask(
  db: AppDatabase,
  shopId: string,
  profile: ReturnType<typeof getShopAuthStorage>,
  task: CouponBatch['tasks'][number]
) {
  updateCouponTaskStatus(db, task.id, 'running');
  try {
    const result = await withTimeout(
      submitFanCouponTask(profile, {
        ...task,
        shopId
      }),
      COUPON_TASK_TIMEOUT_MS
    );
    updateCouponTaskStatus(
      db,
      task.id,
      result.submitted ? 'success' : 'waiting_confirm',
      result.submitted ? null : result.message
    );
  } catch (caught) {
    updateCouponTaskStatus(
      db,
      task.id,
      'failed',
      caught instanceof Error ? caught.message : '建券任务失败'
    );
  }
}

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
  options: {
    delayMs?: number;
    shouldStop?: () => boolean;
  } = {}
) {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, Math.floor(concurrency)), items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      if (options.shouldStop?.()) return;
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
      if (options.delayMs) await wait(options.delayMs);
    }
  }));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`建券任务超时：${timeoutMs / 1000} 秒内没有完成`)), timeoutMs);
    })
  ]);
}

function finalBatchStatus(batch: CouponBatch | undefined) {
  if (!batch) return 'failed';
  const failed = batch.tasks.filter((task) => task.status === 'failed').length;
  const success = batch.tasks.filter((task) => task.status === 'success').length;
  const waiting = batch.tasks.filter((task) => task.status === 'waiting_confirm').length;
  const done = success + waiting;
  if (failed === 0 && success === batch.totalCount) return 'success';
  if (failed === 0 && done === batch.totalCount) return 'waiting_confirm';
  if (failed === batch.totalCount) return 'failed';
  if (done > 0 || failed > 0) return 'partial';
  return 'failed';
}
