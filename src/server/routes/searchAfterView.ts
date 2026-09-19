import { Router } from 'express';
import { getShopAuthStorage } from '../../db/shops';
import { submitSearchAfterViewTask } from '../../rpa/searchAfterView';
import { db } from '../db';

export const searchAfterViewRouter = Router();

searchAfterViewRouter.post('/search-after-view', async (request, response) => {
  const shopId = String(request.body?.shopId ?? '').trim();
  const keywords = Array.isArray(request.body?.keywords) ? request.body.keywords : [];
  const sku = String(request.body?.sku ?? '').trim() || undefined;
  const autoSubmit = request.body?.autoSubmit === true;

  if (!shopId) {
    response.status(400).json({ error: '请选择店铺' });
    return;
  }

  try {
    const profile = getShopAuthStorage(db, shopId);
    const result = await submitSearchAfterViewTask(profile, { shopId, keywords, sku }, { autoSubmit });
    response.json(result);
  } catch (caught) {
    response.status(500).json({ error: caught instanceof Error ? caught.message : '看后搜配置失败' });
  }
});
