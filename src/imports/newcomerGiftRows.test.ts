import { describe, expect, it } from 'vitest';
import { normalizeNewcomerGiftRow, validateNewcomerGiftRow } from './newcomerGiftRows';

describe('newcomer gift rows', () => {
  it('uses style code for activity name and product search by default', () => {
    const row = normalizeNewcomerGiftRow(
      { '款号': '216704', '礼金金额': '20' },
      {
        startTime: '2026-08-28 00:00:00',
        endTime: '2026-09-03 23:59:59'
      }
    );

    expect(row).toMatchObject({
      sku: '216704',
      activityName: '216704',
      productSearchKeyword: '216704',
      discountAmount: 20
    });
  });

  it('rejects rows without style code or gift amount', () => {
    expect(validateNewcomerGiftRow({})).toEqual([
      '款号不能为空',
      '礼金金额必须大于 0'
    ]);
  });
});
