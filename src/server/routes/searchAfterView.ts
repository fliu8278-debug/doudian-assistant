import { Router } from 'express';
import { getShopAuthStorage } from '../../db/shops';
import { submitSearchAfterViewTask } from '../../rpa/searchAfterView';
import { db } from '../db';
import { SearchAfterViewQueue } from '../searchAfterViewQueue';

const searchAfterViewQueue = new SearchAfterViewQueue(async (input, signal, onTarget) => {
  const profile = getShopAuthStorage(db, input.shopId);
  return submitSearchAfterViewTask(profile, input, { autoSubmit: true, signal, onTarget });
});

export function createSearchAfterViewRouter(queue = searchAfterViewQueue) {
  const router = Router();

  router.post('/search-after-view', (request, response) => {
  const shopId = String(request.body?.shopId ?? '').trim();
  const keywords = Array.isArray(request.body?.keywords) ? request.body.keywords : [];
  const sku = String(request.body?.sku ?? '').trim() || undefined;

  if (!shopId) {
    response.status(400).json({ error: '请选择店铺' });
    return;
  }

    response.status(202).json(queue.start({ shopId, keywords, sku }));
  });

  router.get('/search-after-view/:id', (request, response) => {
    const task = queue.get(request.params.id);
    if (!task) {
      response.status(404).json({ error: '看后搜任务不存在' });
      return;
    }
    response.json(task);
  });

  router.post('/search-after-view/:id/pause', async (request, response) => {
    const task = await queue.pause(request.params.id);
    if (!task) {
      response.status(404).json({ error: '看后搜任务不存在' });
      return;
    }
    response.json(task);
  });

  return router;
}

export const searchAfterViewRouter = createSearchAfterViewRouter();
