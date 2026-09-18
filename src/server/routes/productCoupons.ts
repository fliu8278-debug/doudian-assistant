import { Router } from 'express';
import { getCouponBatch } from '../../db/couponTasks';
import type { CouponRow } from '../../shared/types';
import type { ProductSelectionMode } from '../../rpa/priceRange';
import { db } from '../db';
import { cancelCouponBatch, enqueueProductCouponBatch } from '../couponQueue';

export const productCouponsRouter = Router();

productCouponsRouter.get('/product-coupon-batches/:id', (request, response) => {
  const batch = getCouponBatch(db, request.params.id);
  if (!batch) return response.status(404).json({ error: '商品优惠券批次不存在' });
  response.json(batch);
});

productCouponsRouter.post('/product-coupon-batches', (request, response) => {
  const shopId = String(request.body?.shopId ?? '').trim();
  const rows = request.body?.rows as CouponRow[] | undefined;
  if (!shopId) return response.status(400).json({ error: '请选择店铺' });
  if (!Array.isArray(rows) || rows.length === 0) return response.status(400).json({ error: '没有可提交的商品优惠券任务' });
  const concurrency = Math.max(1, Math.min(5, Math.floor(Number(request.body?.concurrency) || 1)));
  const selectionMode: ProductSelectionMode = request.body?.selectionMode === 'selfOperated' ? 'selfOperated' : 'nonSelfOperated';
  response.status(202).json(enqueueProductCouponBatch(db, {
    shopId,
    rows,
    concurrency,
    fileName: String(request.body?.fileName ?? '商品优惠券导入').trim(),
    selectionMode
  }));
});

productCouponsRouter.post('/product-coupon-batches/:id/stop', (request, response) => {
  const batch = cancelCouponBatch(db, request.params.id);
  if (!batch) return response.status(404).json({ error: '商品优惠券批次不存在' });
  response.json(batch);
});
