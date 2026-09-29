import { randomUUID } from 'node:crypto';
import type { AppDatabase } from './database';
import { listRecentCouponBatches } from './couponTasks';
import { listRecentNewcomerGiftBatches } from './newcomerGiftTasks';

export type ExecutionKind = 'fan' | 'product' | 'national' | 'legacy' | 'newcomerGift' | 'searchAfterView' | 'videoFrameExtraction';
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'partial' | 'waiting_confirm' | 'paused' | 'complete' | 'interrupted';
export type ExecutionRecord = {
  id: string;
  kind: ExecutionKind;
  title: string;
  status: ExecutionStatus;
  totalCount: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  message: string;
  tasks: Array<{ id: string; sku: string; status: string; message: string }>;
};

type RunInput = Omit<ExecutionRecord, 'createdAt' | 'updatedAt' | 'tasks'> & { createdAt?: string; sku?: string };

export function saveExecutionRun(db: AppDatabase, input: RunInput) {
  ensureExecutionRunColumns(db);
  const now = new Date().toISOString();
  const createdAt = input.createdAt ?? now;
  db.prepare(`
    insert into execution_runs (id, kind, title, status, total_count, success_count, failed_count, message, sku, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(id) do update set kind=excluded.kind, title=excluded.title, status=excluded.status,
      total_count=excluded.total_count, success_count=excluded.success_count, failed_count=excluded.failed_count,
      message=excluded.message, sku=excluded.sku, updated_at=excluded.updated_at
  `).run(input.id, input.kind, input.title, input.status, input.totalCount, input.successCount, input.failedCount, input.message, input.sku ?? '', createdAt, now);
}

function ensureExecutionRunColumns(db: AppDatabase) {
  const columns = db.prepare('pragma table_info(execution_runs)').all().map((row) => (row as { name: string }).name);
  if (!columns.includes('sku')) db.prepare("alter table execution_runs add column sku text not null default ''").run();
}

export function listExecutionRecords(db: AppDatabase, limit = 100): ExecutionRecord[] {
  const couponRecords = listRecentCouponBatches(db, limit).map((batch) => ({
    id: batch.id, kind: batch.kind, title: batch.fileName, status: batch.status, totalCount: batch.totalCount,
    successCount: batch.successCount, failedCount: batch.failedCount, createdAt: batch.createdAt, updatedAt: batch.createdAt,
    message: '', tasks: batch.tasks.map((task) => ({ id: task.id, sku: task.sku, status: task.status, message: task.errorMessage ?? '' }))
  } satisfies ExecutionRecord));
  const newcomerRecords = listRecentNewcomerGiftBatches(db, limit).map((batch) => ({
    id: batch.id, kind: 'newcomerGift' as const, title: batch.fileName, status: batch.status, totalCount: batch.totalCount,
    successCount: batch.successCount, failedCount: batch.failedCount, createdAt: batch.createdAt, updatedAt: batch.createdAt,
    message: '', tasks: batch.tasks.map((task) => ({ id: task.id, sku: task.sku, status: task.status, message: task.errorMessage ?? '' }))
  }));
  const rows = db.prepare('select * from execution_runs order by created_at desc limit ?').all(limit) as Array<Record<string, unknown>>;
  const runRecords = rows.map((row) => {
    const status = row.status === 'running' ? 'interrupted' : row.status as ExecutionStatus;
    return { id: String(row.id), kind: row.kind as ExecutionKind, title: String(row.title), status, totalCount: Number(row.total_count), successCount: Number(row.success_count), failedCount: Number(row.failed_count), createdAt: String(row.created_at), updatedAt: String(row.updated_at), message: String(row.message ?? ''), tasks: [{ id: String(row.id), sku: String(row.sku ?? ''), status, message: String(row.message ?? '') }] };
  });
  return [...couponRecords, ...newcomerRecords, ...runRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export function newExecutionId() { return randomUUID(); }
