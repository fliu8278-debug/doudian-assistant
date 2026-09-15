import type { CouponBatchTime, NewcomerGiftRow } from '../shared/types';
import { validateCouponBatchTime } from './couponRows';

type RawRow = Record<string, unknown>;

export function validateNewcomerGiftRow(row: RawRow) {
  const errors: string[] = [];

  if (!styleCode(row)) errors.push('款号不能为空');
  if (positiveNumber(row['礼金金额']) <= 0) errors.push('礼金金额必须大于 0');

  return errors;
}

export function normalizeNewcomerGiftRow(row: RawRow, time: CouponBatchTime): NewcomerGiftRow {
  const errors = [...validateNewcomerGiftRow(row), ...validateCouponBatchTime(time)];
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  const code = styleCode(row);

  return {
    sku: code,
    activityName: text(row['活动名称']) || code,
    productSearchKeyword: text(row['商品搜索关键词']) || code,
    startTime: time.startTime,
    endTime: time.endTime,
    discountAmount: positiveNumber(row['礼金金额'])
  };
}

function styleCode(row: RawRow) {
  const rawCode = text(row['款号']) || text(row['商品编码']);
  return rawCode.split('-')[0] ?? '';
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
