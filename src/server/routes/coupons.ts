import { Router } from 'express';
import { getCouponBatch, listRecentCouponBatches } from '../../db/couponTasks';
import type { CouponRow } from '../../shared/types';
import { db } from '../db';
import { cancelCouponBatch, enqueueCouponBatch } from '../couponQueue';

export const couponsRouter = Router();

couponsRouter.get('/coupon-batches', (_request, response) => {
  response.json(listRecentCouponBatches(db));
});

couponsRouter.get('/coupon-batches/:id', (request, response) => {
  const batch = getCouponBatch(db, request.params.id);
  if (!batch) {
    response.status(404).json({ error: '优惠券批次不存在' });
    return;
  }

  response.json(batch);
});

couponsRouter.post('/coupon-batches', (request, response) => {
  const shopId = String(request.body?.shopId ?? '').trim();
  const rows = request.body?.rows as CouponRow[] | undefined;
  const fileName = String(request.body?.fileName ?? '手动提交').trim();
  const concurrency = normalizeConcurrency(request.body?.concurrency);

  if (!shopId) {
    response.status(400).json({ error: '请选择店铺' });
    return;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    response.status(400).json({ error: '没有可提交的优惠券任务' });
    return;
  }

  response.status(202).json(enqueueCouponBatch(db, { shopId, fileName, rows, concurrency }));
});

couponsRouter.post('/coupon-batches/:id/stop', (request, response) => {
  const batch = cancelCouponBatch(db, request.params.id);
  if (!batch) {
    response.status(404).json({ error: '优惠券批次不存在' });
    return;
  }

  response.json(batch);
});

function normalizeConcurrency(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(1, Math.min(5, Math.floor(number)));
}
