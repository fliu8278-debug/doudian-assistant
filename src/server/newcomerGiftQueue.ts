import {
  createNewcomerGiftBatch,
  getNewcomerGiftBatch,
  listPendingNewcomerGiftTasks,
  stopPendingNewcomerGiftTasks,
  updateNewcomerGiftBatchStatus,
  updateNewcomerGiftTaskStatus
} from '../db/newcomerGiftTasks';
import { getShopAuthStorage } from '../db/shops';
import { submitNewcomerGiftTask } from '../rpa/newcomerGift';
import { closeDoudianShopPages } from '../rpa/doudianSession';
import type { AppDatabase } from '../db/database';
import type { NewcomerGiftBatch, NewcomerGiftRow } from '../shared/types';
import { runWithConcurrency } from './couponQueue';

const runningBatches = new Set<string>();
const cancelledBatches = new Set<string>();
const DEFAULT_WORKER_CONCURRENCY = 1;
const NEWCOMER_GIFT_TASK_TIMEOUT_MS = 90_000;
const NEWCOMER_GIFT_TASK_GAP_MS = 1_000;

export function newcomerGiftTaskGapMs() {
  return NEWCOMER_GIFT_TASK_GAP_MS;
}

export function newcomerGiftWorkerCount(_requested?: number) {
  return DEFAULT_WORKER_CONCURRENCY;
}

export function enqueueNewcomerGiftBatch(
  db: AppDatabase,
  input: {
    shopId: string;
    fileName: string;
    rows: NewcomerGiftRow[];
    concurrency?: number;
  }
) {
  const batch = createNewcomerGiftBatch(db, input);
  if (!batch) throw new Error('创建新人礼金任务失败');
  cancelledBatches.delete(batch.id);
  void runNewcomerGiftBatch(db, batch.id, newcomerGiftWorkerCount(input.concurrency));
  return batch;
}

export async function cancelNewcomerGiftBatch(db: AppDatabase, batchId: string) {
  cancelledBatches.add(batchId);
  const batch = getNewcomerGiftBatch(db, batchId);
  if (batch) {
    await closeDoudianShopPages(getShopAuthStorage(db, batch.shopId), '/allowance/create');
  }
  stopPendingNewcomerGiftTasks(db, batchId, '已停止');
  updateNewcomerGiftBatchStatus(db, batchId, finalBatchStatus(getNewcomerGiftBatch(db, batchId)));
  return getNewcomerGiftBatch(db, batchId);
}

async function runNewcomerGiftBatch(db: AppDatabase, batchId: string, concurrency: number) {
  if (runningBatches.has(batchId)) return;
  runningBatches.add(batchId);
  updateNewcomerGiftBatchStatus(db, batchId, 'running');

  try {
    const batch = getNewcomerGiftBatch(db, batchId);
    if (!batch) throw new Error('新人礼金批次不存在');
    const profile = getShopAuthStorage(db, batch.shopId);

    await runWithConcurrency(
      listPendingNewcomerGiftTasks(db, batchId),
      concurrency,
      (task) => runNewcomerGiftTask(db, batch.shopId, profile, task),
      {
        delayMs: NEWCOMER_GIFT_TASK_GAP_MS,
        shouldStop: () => cancelledBatches.has(batchId)
      }
    );

    updateNewcomerGiftBatchStatus(db, batchId, finalBatchStatus(getNewcomerGiftBatch(db, batchId)));
  } catch (caught) {
    failPendingNewcomerGiftTasks(db, batchId, caught instanceof Error ? caught.message : '新人礼金批次失败');
    updateNewcomerGiftBatchStatus(db, batchId, 'failed');
  } finally {
    runningBatches.delete(batchId);
    cancelledBatches.delete(batchId);
  }
}

function failPendingNewcomerGiftTasks(db: AppDatabase, batchId: string, message: string) {
  for (const task of listPendingNewcomerGiftTasks(db, batchId)) {
    updateNewcomerGiftTaskStatus(db, task.id, 'failed', message);
  }
}

async function runNewcomerGiftTask(
  db: AppDatabase,
  shopId: string,
  profile: ReturnType<typeof getShopAuthStorage>,
  task: NewcomerGiftBatch['tasks'][number]
) {
  updateNewcomerGiftTaskStatus(db, task.id, 'running');
  try {
    const result = await withTimeout(
      submitNewcomerGiftTask(profile, {
        ...task,
        shopId
      }),
      NEWCOMER_GIFT_TASK_TIMEOUT_MS
    );
    if (cancelledBatches.has(task.batchId)) return;
    updateNewcomerGiftTaskStatus(
      db,
      task.id,
      result.submitted ? 'success' : 'waiting_confirm',
      result.submitted ? null : result.message
    );
  } catch (caught) {
    updateNewcomerGiftTaskStatus(
      db,
      task.id,
      'failed',
      caught instanceof Error ? caught.message : '新人礼金任务失败'
    );
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`新人礼金任务超时：${timeoutMs / 1000} 秒内没有完成`)), timeoutMs);
    })
  ]);
}

function finalBatchStatus(batch: NewcomerGiftBatch | undefined) {
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
