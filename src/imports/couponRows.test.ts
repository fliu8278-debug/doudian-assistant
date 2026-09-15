import { describe, expect, it } from 'vitest';
import { normalizeCouponRow, validateCouponBatchTime, validateCouponRow } from './couponRows';

describe('coupon row import', () => {
  it('normalizes a spreadsheet row into a fan coupon task', () => {
    const row = normalizeCouponRow(
      {
        款号: '216704',
        SKU: 'BLK',
        优惠券名称: '',
        满减门槛: 2,
        减免金额: 1,
        商品搜索关键词: ''
      },
      {
        startTime: '2026-08-28 09:30:15',
        endTime: '2026-09-03 18:45:30'
      }
    );

    expect(row).toEqual({
      sku: '216704-BLK',
      couponName: '216704',
      productSearchKeyword: '216704-BLK',
      startTime: '2026-08-28 09:30:15',
      endTime: '2026-09-03 18:45:30',
      validDays: 1,
      thresholdAmount: 2,
      discountAmount: 1,
      issueAmountType: 'unlimited',
      perUserLimit: 'unlimited',
      goodsScope: 'specified'
    });
  });

  it('reports required-field errors', () => {
    const errors = validateCouponRow({
      款号: '',
      满减门槛: '',
      减免金额: 1
    });

    expect(errors).toEqual([
      '款号不能为空',
      '满减门槛必须大于 0'
    ]);
  });

  it('keeps explicit coupon name and search keyword when filled', () => {
    const row = normalizeCouponRow(
      {
        款号: '246240',
        SKU: 'YEL',
        优惠券名称: '246240-YEL-粉丝券',
        满减门槛: 899,
        减免金额: 100,
        商品搜索关键词: '246240'
      },
      {
        startTime: '2026-08-28 00:00:00',
        endTime: '2026-09-03 23:59:59'
      }
    );

    expect(row.couponName).toBe('246240-YEL-粉丝券');
    expect(row.productSearchKeyword).toBe('246240');
    expect(row.validDays).toBe(1);
  });

  it('accepts old combined code and splits it for defaults', () => {
    const row = normalizeCouponRow(
      {
        '款号/商品编码': '246240-YEL',
        满减门槛: 899,
        减免金额: 100
      },
      {
        startTime: '2026-08-28 00:00:00',
        endTime: '2026-09-03 23:59:59'
      }
    );

    expect(row.sku).toBe('246240-YEL');
    expect(row.couponName).toBe('246240');
    expect(row.productSearchKeyword).toBe('246240-YEL');
  });

  it('validates batch time from the coupon page', () => {
    expect(validateCouponBatchTime({
      startTime: '2026-08-28 00:00:00',
      endTime: '2026-09-03 23:59:59'
    })).toEqual([]);

    expect(validateCouponBatchTime({
      startTime: '2026-09-03 23:59:59',
      endTime: '2026-08-28 00:00:00'
    })).toEqual(['领取结束时间必须晚于开始时间']);
  });
});
