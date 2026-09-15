import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DatabaseSync } from 'node:sqlite';
import { createCouponBatch, getCouponBatch, updateCouponBatchStatus, updateCouponTaskStatus } from './couponTasks';
import { openDatabase } from './database';
import { createShop } from './shops';

let tempDir = '';
let db: DatabaseSync | null = null;

afterEach(() => {
  db?.close();
  db = null;
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = '';
});

function testDbPath() {
  tempDir = mkdtempSync(join(tmpdir(), 'doudian-tool-'));
  return join(tempDir, 'app.sqlite');
}

describe('coupon tasks', () => {
  it('creates a batch with five queued coupon tasks', () => {
    db = openDatabase(testDbPath());
    const shop = createShop(db, {
      name: '斯凯奇旗舰店',
      remark: '',
      officialAccountName: '店铺官方号'
    });

    const batch = createCouponBatch(db, {
      shopId: shop.id,
      fileName: 'test.xlsx',
      rows: Array.from({ length: 5 }, (_, index) => ({
        sku: `21670${index}`,
        couponName: `21670${index}`,
        productSearchKeyword: `21670${index}`,
        startTime: '2026-08-28 00:00:00',
        endTime: '2026-09-03 23:59:59',
        validDays: 1,
        thresholdAmount: 899,
        discountAmount: 100,
        issueAmountType: 'unlimited',
        perUserLimit: 'unlimited',
        goodsScope: 'specified'
      }))
    });

    expect(batch?.totalCount).toBe(5);
    expect(batch?.tasks).toHaveLength(5);
    expect(batch?.tasks[0].productSearchKeyword).toBe('216700');

    updateCouponTaskStatus(db, batch!.tasks[0].id, 'waiting_confirm', '已预热创建页');
    updateCouponBatchStatus(db, batch!.id, 'waiting_confirm');

    const updated = getCouponBatch(db, batch!.id);
    expect(updated?.status).toBe('waiting_confirm');
    expect(updated?.tasks[0].status).toBe('waiting_confirm');
  });
});
