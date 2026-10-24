import { describe, expect, it, vi } from 'vitest';
import { openDatabase } from '../db/database';
import { getNewcomerGiftBatch } from '../db/newcomerGiftTasks';

const { submitNewcomerGiftTask } = vi.hoisted(() => ({ submitNewcomerGiftTask: vi.fn() }));
vi.mock('../rpa/newcomerGift', () => ({ submitNewcomerGiftTask }));

import { enqueueNewcomerGiftBatch, newcomerGiftTaskGapMs, newcomerGiftWorkerCount } from './newcomerGiftQueue';

describe('新人礼金队列', () => {
  it('uses a one-second gap between sequential tasks', () => {
    expect(newcomerGiftTaskGapMs()).toBe(1_000);
  });

  it('runs one task at a time even when the request asks for more workers', () => {
    expect(newcomerGiftWorkerCount(5)).toBe(1);
  });

  it('records an absent product as skipped and continues to the next gift', async () => {
    const db = openDatabase(':memory:');
    try {
      db.prepare("insert into shops (id, name, official_account_name, created_at) values ('shop', '测试店', '账号', '2026-10-24')").run();
      db.prepare("insert into browser_profiles (id, shop_id, profile_path, cookie_path, created_at) values ('profile', 'shop', 'unused', 'unused', '2026-10-24')").run();
      submitNewcomerGiftTask.mockReset()
        .mockResolvedValueOnce({ submitted: false, skipped: true, message: '已跳过款号：113821，商品搜索无结果' })
        .mockResolvedValueOnce({ submitted: true, message: '已提交新人礼金：216704' });
      const row = (sku: string) => ({ sku, activityName: sku, productSearchKeyword: sku,
        startTime: '2026-10-24 00:00:00', endTime: '2026-11-14 23:59:59', discountAmount: 5 });

      const batch = enqueueNewcomerGiftBatch(db, { shopId: 'shop', fileName: 'gift.csv', rows: [row('113821'), row('216704')] });
      await vi.waitFor(() => expect(getNewcomerGiftBatch(db, batch!.id)?.status).toBe('success'), { timeout: 5_000 });

      expect(getNewcomerGiftBatch(db, batch!.id)?.tasks.map((task) => task.status)).toEqual(['skipped', 'success']);
      expect(submitNewcomerGiftTask).toHaveBeenCalledTimes(2);
    } finally {
      db.close();
    }
  }, 6_000);
});
