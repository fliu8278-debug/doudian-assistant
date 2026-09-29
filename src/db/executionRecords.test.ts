import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './database';
import { createShop } from './shops';
import { createCouponBatch } from './couponTasks';
import { listExecutionRecords, saveExecutionRun } from './executionRecords';

const directory = mkdtempSync(join(tmpdir(), 'execution-records-'));
const db = openDatabase(join(directory, 'app.sqlite'));
afterEach(() => { db.exec('delete from execution_runs; delete from coupon_batches;'); });

it('shows explicit coupon kind, labels unknown historical batches, and merges newer jobs first', () => {
  const shop = createShop(db, { name: '测试店铺', remark: '', officialAccountName: '账号' });
  createCouponBatch(db, { shopId: shop.id, fileName: 'fan.xlsx', rows: [], kind: 'fan' });
  createCouponBatch(db, { shopId: shop.id, fileName: 'old.xlsx', rows: [] });
  saveExecutionRun(db, { id: 'search-1', kind: 'searchAfterView', title: '看后搜', status: 'running', totalCount: 1, successCount: 0, failedCount: 0, message: '正在配置' });
  const records = listExecutionRecords(db);
  expect(records.map((record) => record.kind)).toContain('fan');
  expect(records.map((record) => record.kind)).toContain('legacy');
  expect(records[0].kind).toBe('searchAfterView');
});

it('keeps Chinese failure reasons and marks an unclosed running job interrupted on restart', () => {
  saveExecutionRun(db, { id: 'frame-1', kind: 'videoFrameExtraction', title: '视频.mp4', status: 'running', totalCount: 1, successCount: 0, failedCount: 0, message: '处理中' });
  saveExecutionRun(db, { id: 'search-2', kind: 'searchAfterView', title: '看后搜', status: 'failed', totalCount: 1, successCount: 0, failedCount: 1, message: '商品选择失败' });
  const records = listExecutionRecords(db);
  expect(records.find((record) => record.id === 'frame-1')?.status).toBe('interrupted');
  expect(records.find((record) => record.id === 'search-2')?.tasks[0].message).toBe('商品选择失败');
});

afterEach(() => { /* database stays open for isolated cases above */ });
