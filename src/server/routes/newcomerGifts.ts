import { Router } from 'express';
import { getNewcomerGiftBatch } from '../../db/newcomerGiftTasks';
import type { NewcomerGiftRow } from '../../shared/types';
import { db } from '../db';
import { cancelNewcomerGiftBatch, enqueueNewcomerGiftBatch } from '../newcomerGiftQueue';

export const newcomerGiftsRouter = Router();

newcomerGiftsRouter.get('/newcomer-gift-batches/:id', (request, response) => {
  const batch = getNewcomerGiftBatch(db, request.params.id);
  if (!batch) {
    response.status(404).json({ error: '新人礼金批次不存在' });
    return;
  }

  response.json(batch);
});

newcomerGiftsRouter.post('/newcomer-gift-batches', (request, response) => {
  const shopId = String(request.body?.shopId ?? '').trim();
  const rows = request.body?.rows as NewcomerGiftRow[] | undefined;
  const fileName = String(request.body?.fileName ?? '手动提交').trim();
  const concurrency = normalizeConcurrency(request.body?.concurrency);

  if (!shopId) {
    response.status(400).json({ error: '请选择店铺' });
    return;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    response.status(400).json({ error: '没有可提交的新人礼金任务' });
    return;
  }

  response.status(202).json(enqueueNewcomerGiftBatch(db, { shopId, fileName, rows, concurrency }));
});

newcomerGiftsRouter.post('/newcomer-gift-batches/:id/stop', async (request, response) => {
  try {
    const batch = await cancelNewcomerGiftBatch(db, request.params.id);
    if (!batch) {
      response.status(404).json({ error: '新人礼金批次不存在' });
      return;
    }

    response.json(batch);
  } catch (caught) {
    response.status(500).json({ error: caught instanceof Error ? caught.message : '停止新人礼金失败' });
  }
});

function normalizeConcurrency(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 2;
  return Math.max(1, Math.min(5, Math.floor(number)));
}
