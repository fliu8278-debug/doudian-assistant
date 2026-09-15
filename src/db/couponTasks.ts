import { randomUUID } from 'node:crypto';
import type { CouponBatch, CouponBatchStatus, CouponRow, CouponTask, CouponTaskStatus } from '../shared/types';
import type { AppDatabase } from './database';

type CouponBatchRow = {
  id: string;
  shop_id: string;
  file_name: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  status: CouponBatchStatus;
  created_at: string;
};

type CouponTaskRow = {
  id: string;
  batch_id: string;
  shop_id: string;
  sku: string;
  coupon_name: string;
  product_search_keyword?: string;
  start_time: string;
  end_time: string;
  valid_days: number;
  threshold_amount: number;
  discount_amount: number;
  issue_amount_type: 'unlimited' | 'limited';
  per_user_limit: string;
  goods_scope: 'specified' | 'all';
  status: CouponTaskStatus;
  error_message: string | null;
  screenshot_path: string | null;
  created_at: string;
  updated_at: string;
};

export function createCouponBatch(
  db: AppDatabase,
  input: {
    shopId: string;
    fileName: string;
    rows: CouponRow[];
  }
) {
  ensureCouponTaskColumns(db);
  const now = new Date().toISOString();
  const batchId = randomUUID();

  db.exec('begin');
  try {
    db.prepare(`
      insert into coupon_batches (
        id, shop_id, file_name, total_count, success_count, failed_count, status, created_at
      ) values (?, ?, ?, ?, 0, 0, 'pending', ?)
    `).run(batchId, input.shopId, input.fileName, input.rows.length, now);

    const insertTask = db.prepare(`
      insert into coupon_tasks (
        id, batch_id, shop_id, sku, coupon_name, product_search_keyword, start_time, end_time,
        valid_days, threshold_amount, discount_amount, issue_amount_type, per_user_limit,
        goods_scope, status, error_message, screenshot_path, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', null, null, ?, ?)
    `);

    for (const row of input.rows) {
      insertTask.run(
        randomUUID(),
        batchId,
        input.shopId,
        row.sku,
        row.couponName,
        row.productSearchKeyword,
        row.startTime,
        row.endTime,
        row.validDays,
        row.thresholdAmount,
        row.discountAmount,
        row.issueAmountType,
        String(row.perUserLimit),
        row.goodsScope,
        now,
        now
      );
    }

    db.exec('commit');
  } catch (error) {
    db.exec('rollback');
    throw error;
  }

  return getCouponBatch(db, batchId);
}

export function getCouponBatch(db: AppDatabase, batchId: string) {
  ensureCouponTaskColumns(db);
  const row = db
    .prepare('select * from coupon_batches where id = ?')
    .get(batchId) as CouponBatchRow | undefined;

  if (!row) return undefined;
  return mapBatch(row, listCouponTasks(db, batchId));
}

export function listRecentCouponBatches(db: AppDatabase, limit = 10) {
  ensureCouponTaskColumns(db);
  return db
    .prepare('select * from coupon_batches order by created_at desc limit ?')
    .all(limit)
    .map((row) => mapBatch(row as CouponBatchRow, listCouponTasks(db, (row as CouponBatchRow).id)));
}

export function listPendingCouponTasks(db: AppDatabase, batchId: string) {
  ensureCouponTaskColumns(db);
  return listCouponTasks(db, batchId).filter((task) => task.status === 'pending');
}

export function stopPendingCouponTasks(db: AppDatabase, batchId: string, message = '已停止') {
  ensureCouponTaskColumns(db);
  db.prepare(`
    update coupon_tasks
    set status = 'failed', error_message = ?, updated_at = ?
    where batch_id = ? and status = 'pending'
  `).run(message, new Date().toISOString(), batchId);
}

export function updateCouponTaskStatus(
  db: AppDatabase,
  taskId: string,
  status: CouponTaskStatus,
  errorMessage: string | null = null
) {
  ensureCouponTaskColumns(db);
  db.prepare(`
    update coupon_tasks
    set status = ?, error_message = ?, updated_at = ?
    where id = ?
  `).run(status, errorMessage, new Date().toISOString(), taskId);
}

export function updateCouponBatchStatus(db: AppDatabase, batchId: string, status: CouponBatchStatus) {
  ensureCouponTaskColumns(db);
  const counts = db.prepare(`
    select
      sum(case when status = 'success' then 1 else 0 end) as success_count,
      sum(case when status = 'failed' then 1 else 0 end) as failed_count
    from coupon_tasks
    where batch_id = ?
  `).get(batchId) as { success_count: number | null; failed_count: number | null };

  db.prepare(`
    update coupon_batches
    set status = ?, success_count = ?, failed_count = ?
    where id = ?
  `).run(status, counts.success_count ?? 0, counts.failed_count ?? 0, batchId);
}

function listCouponTasks(db: AppDatabase, batchId: string) {
  return db
    .prepare('select * from coupon_tasks where batch_id = ? order by created_at asc')
    .all(batchId)
    .map((row) => mapTask(row as CouponTaskRow));
}

function mapBatch(row: CouponBatchRow, tasks: CouponTask[]): CouponBatch {
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

function mapTask(row: CouponTaskRow): CouponTask {
  return {
    id: row.id,
    batchId: row.batch_id,
    shopId: row.shop_id,
    sku: row.sku,
    couponName: row.coupon_name,
    productSearchKeyword: row.product_search_keyword ?? row.sku,
    startTime: row.start_time,
    endTime: row.end_time,
    validDays: row.valid_days,
    thresholdAmount: row.threshold_amount,
    discountAmount: row.discount_amount,
    issueAmountType: row.issue_amount_type,
    perUserLimit: row.per_user_limit === 'unlimited' ? 'unlimited' : Number(row.per_user_limit),
    goodsScope: row.goods_scope,
    status: row.status,
    errorMessage: row.error_message,
    screenshotPath: row.screenshot_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function ensureCouponTaskColumns(db: AppDatabase) {
  const columns = db
    .prepare('pragma table_info(coupon_tasks)')
    .all()
    .map((row) => (row as { name: string }).name);

  if (!columns.includes('product_search_keyword')) {
    db.prepare("alter table coupon_tasks add column product_search_keyword text not null default ''").run();
  }
}
