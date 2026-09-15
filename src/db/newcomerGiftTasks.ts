import { randomUUID } from 'node:crypto';
import type {
  CouponBatchStatus,
  CouponTaskStatus,
  NewcomerGiftBatch,
  NewcomerGiftRow,
  NewcomerGiftTask
} from '../shared/types';
import type { AppDatabase } from './database';

type NewcomerGiftBatchRow = {
  id: string;
  shop_id: string;
  file_name: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  status: CouponBatchStatus;
  created_at: string;
};

type NewcomerGiftTaskRow = {
  id: string;
  batch_id: string;
  shop_id: string;
  sku: string;
  activity_name: string;
  product_search_keyword: string;
  start_time: string;
  end_time: string;
  discount_amount: number;
  status: CouponTaskStatus;
  error_message: string | null;
  screenshot_path: string | null;
  created_at: string;
  updated_at: string;
};

export function createNewcomerGiftBatch(
  db: AppDatabase,
  input: {
    shopId: string;
    fileName: string;
    rows: NewcomerGiftRow[];
  }
) {
  const now = new Date().toISOString();
  const batchId = randomUUID();

  db.exec('begin');
  try {
    db.prepare(`
      insert into newcomer_gift_batches (
        id, shop_id, file_name, total_count, success_count, failed_count, status, created_at
      ) values (?, ?, ?, ?, 0, 0, 'pending', ?)
    `).run(batchId, input.shopId, input.fileName, input.rows.length, now);

    const insertTask = db.prepare(`
      insert into newcomer_gift_tasks (
        id, batch_id, shop_id, sku, activity_name, product_search_keyword,
        start_time, end_time, discount_amount, status, error_message, screenshot_path,
        created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', null, null, ?, ?)
    `);

    for (const row of input.rows) {
      insertTask.run(
        randomUUID(),
        batchId,
        input.shopId,
        row.sku,
        row.activityName,
        row.productSearchKeyword,
        row.startTime,
        row.endTime,
        row.discountAmount,
        now,
        now
      );
    }

    db.exec('commit');
  } catch (error) {
    db.exec('rollback');
    throw error;
  }

  return getNewcomerGiftBatch(db, batchId);
}

export function getNewcomerGiftBatch(db: AppDatabase, batchId: string) {
  const row = db
    .prepare('select * from newcomer_gift_batches where id = ?')
    .get(batchId) as NewcomerGiftBatchRow | undefined;

  if (!row) return undefined;
  return mapBatch(row, listNewcomerGiftTasks(db, batchId));
}

export function listPendingNewcomerGiftTasks(db: AppDatabase, batchId: string) {
  return listNewcomerGiftTasks(db, batchId).filter((task) => task.status === 'pending');
}

export function stopPendingNewcomerGiftTasks(db: AppDatabase, batchId: string, message = '已停止') {
  db.prepare(`
    update newcomer_gift_tasks
    set status = 'failed', error_message = ?, updated_at = ?
    where batch_id = ? and status in ('pending', 'running')
  `).run(message, new Date().toISOString(), batchId);
}

export function updateNewcomerGiftTaskStatus(
  db: AppDatabase,
  taskId: string,
  status: CouponTaskStatus,
  errorMessage: string | null = null
) {
  db.prepare(`
    update newcomer_gift_tasks
    set status = ?, error_message = ?, updated_at = ?
    where id = ?
  `).run(status, errorMessage, new Date().toISOString(), taskId);
}

export function updateNewcomerGiftBatchStatus(
  db: AppDatabase,
  batchId: string,
  status: CouponBatchStatus
) {
  const counts = db.prepare(`
    select
      sum(case when status = 'success' then 1 else 0 end) as success_count,
      sum(case when status = 'failed' then 1 else 0 end) as failed_count
    from newcomer_gift_tasks
    where batch_id = ?
  `).get(batchId) as { success_count: number | null; failed_count: number | null };

  db.prepare(`
    update newcomer_gift_batches
    set status = ?, success_count = ?, failed_count = ?
    where id = ?
  `).run(status, counts.success_count ?? 0, counts.failed_count ?? 0, batchId);
}

function listNewcomerGiftTasks(db: AppDatabase, batchId: string) {
  return db
    .prepare('select * from newcomer_gift_tasks where batch_id = ? order by created_at asc')
    .all(batchId)
    .map((row) => mapTask(row as NewcomerGiftTaskRow));
}

function mapBatch(row: NewcomerGiftBatchRow, tasks: NewcomerGiftTask[]): NewcomerGiftBatch {
  return {
    id: row.id,
    shopId: row.shop_id,
    fileName: row.file_name,
    totalCount: row.total_count,
    successCount: row.success_count,
    failedCount: row.failed_count,
    status: row.status,
    createdAt: row.created_at,
    tasks
  };
}

function mapTask(row: NewcomerGiftTaskRow): NewcomerGiftTask {
  return {
    id: row.id,
    batchId: row.batch_id,
    shopId: row.shop_id,
    sku: row.sku,
    activityName: row.activity_name,
    productSearchKeyword: row.product_search_keyword || row.sku,
    startTime: row.start_time,
    endTime: row.end_time,
    discountAmount: row.discount_amount,
    status: row.status,
    errorMessage: row.error_message,
    screenshotPath: row.screenshot_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
