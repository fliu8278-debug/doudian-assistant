import type { CouponBatchTime, CouponRow } from '../shared/types';

type RawRow = Record<string, unknown>;

export function validateCouponRow(row: RawRow) {
  const errors: string[] = [];

  if (!styleCode(row)) errors.push('款号不能为空');
  if (positiveNumber(row['满减门槛']) <= 0) errors.push('满减门槛必须大于 0');
  if (positiveNumber(row['减免金额']) <= 0) errors.push('减免金额必须大于 0');

  return errors;
}

export function validateCouponBatchTime(time: CouponBatchTime) {
  const errors: string[] = [];

  if (!isDateTime(time.startTime)) errors.push('领取开始时间格式不正确');
  if (!isDateTime(time.endTime)) errors.push('领取结束时间格式不正确');
  if (isDateTime(time.startTime) && isDateTime(time.endTime) && time.startTime >= time.endTime) {
    errors.push('领取结束时间必须晚于开始时间');
  }

  return errors;
}

export function normalizeCouponRow(row: RawRow, time: CouponBatchTime): CouponRow {
  const errors = [...validateCouponRow(row), ...validateCouponBatchTime(time)];
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  const code = styleCode(row);
  const sku = skuCode(row);
  const productCode = sku ? `${code}-${sku}` : code;

  return {
    sku: productCode,
    couponName: text(row['优惠券名称']) || code,
    productSearchKeyword: text(row['商品搜索关键词']) || productCode,
    startTime: time.startTime,
    endTime: time.endTime,
    validDays: 1,
    thresholdAmount: positiveNumber(row['满减门槛']),
    discountAmount: positiveNumber(row['减免金额']),
    issueAmountType: 'unlimited',
    perUserLimit: 'unlimited',
    goodsScope: 'specified'
  };
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function styleCode(row: RawRow) {
  const rawCode = text(row['款号']) || text(row['款号/商品编码']) || text(row['商品编码']);
  return rawCode.split('-')[0] ?? '';
}

function skuCode(row: RawRow) {
  const explicitSku = text(row['SKU']) || text(row['sku']) || text(row['颜色码']);
  if (explicitSku) return explicitSku;

  const rawCode = text(row['款号/商品编码']) || text(row['商品编码']);
  const parts = rawCode.split('-');
  return parts.length > 1 ? parts.slice(1).join('-') : '';
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isDateTime(value: string) {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) && !Number.isNaN(Date.parse(value.replace(' ', 'T')));
}
