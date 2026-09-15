import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DatabaseSync } from 'node:sqlite';
import {
  createNewcomerGiftBatch,
  getNewcomerGiftBatch,
  updateNewcomerGiftBatchStatus,
  updateNewcomerGiftTaskStatus
} from './newcomerGiftTasks';
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

describe('newcomer gift tasks', () => {
  it('creates a batch with queued newcomer gift tasks', () => {
    db = openDatabase(testDbPath());
    const shop = createShop(db, {
      name: '斯凯奇旗舰店',
      remark: '',
      officialAccountName: '店铺官方号'
    });

    const batch = createNewcomerGiftBatch(db, {
      shopId: shop.id,
      fileName: 'gift.csv',
      rows: [{
        sku: '216704',
        activityName: '216704',
        productSearchKeyword: '216704',
        startTime: '2026-08-28 00:00:00',
        endTime: '2026-09-03 23:59:59',
        discountAmount: 20
      }]
    });

    expect(batch?.totalCount).toBe(1);
    expect(batch?.tasks[0]).toMatchObject({
      sku: '216704',
      activityName: '216704',
      discountAmount: 20,
      status: 'pending'
    });

    updateNewcomerGiftTaskStatus(db, batch!.tasks[0].id, 'success');
    updateNewcomerGiftBatchStatus(db, batch!.id, 'success');

    const updated = getNewcomerGiftBatch(db, batch!.id);
    expect(updated?.status).toBe('success');
    expect(updated?.successCount).toBe(1);
  });
});
