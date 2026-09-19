import { Router } from 'express';
import { createShop, deleteShop, getShopAuthStorage, listShops, setCurrentShop, syncShopSnapshot, updateShopSnapshot, updateShopStatus } from '../../db/shops';
import { openDoudianShopWindow, saveDoudianShopCookies } from '../../rpa/doudianSession';
import { readDoudianShopSnapshot } from '../../rpa/shopSnapshot';
import type { ShopStatus } from '../../shared/types';
import { db } from '../db';

export const shopsRouter = Router();

shopsRouter.get('/shops', (_request, response) => {
  response.json(listShops(db));
});

shopsRouter.post('/shops', (request, response) => {
  const name = String(request.body?.name ?? '').trim();
  const officialAccountName = String(request.body?.officialAccountName ?? '').trim();
  const remark = String(request.body?.remark ?? '').trim();

  if (!name || !officialAccountName) {
    response.status(400).json({ error: '店铺名称和账号名称不能为空' });
    return;
  }

  response.status(201).json(createShop(db, { name, officialAccountName, remark }));
});

shopsRouter.post('/shops/sync-visible', (request, response) => {
  const name = String(request.body?.name ?? '').trim();
  const officialAccountName = String(request.body?.officialAccountName ?? '店铺官方号').trim();

  if (!name) {
    response.status(400).json({ error: '店铺名称不能为空' });
    return;
  }

  response.json(
    syncShopSnapshot(db, {
      name,
      officialAccountName,
      snapshot: request.body?.snapshot ?? {}
    })
  );
});

shopsRouter.post('/shops/:id/current', (request, response) => {
  setCurrentShop(db, request.params.id);
  response.json({ ok: true });
});

shopsRouter.delete('/shops/:id', (request, response) => {
  try {
    deleteShop(db, request.params.id);
    response.json({ ok: true });
  } catch (caught) {
    response.status(404).json({ error: caught instanceof Error ? caught.message : '店铺不存在' });
  }
});

shopsRouter.post('/shops/:id/sync', async (request, response) => {
  try {
    const profile = getShopAuthStorage(db, request.params.id);
    const result = await readDoudianShopSnapshot(profile);
    const shop = listShops(db).find((item) => item.id === request.params.id);
    if (shop && result.name && shop.name !== result.name) {
      response.status(409).json({ error: `当前浏览器登录的是「${result.name}」，不是已选择店铺「${shop.name}」` });
      return;
    }

    response.json(updateShopSnapshot(db, request.params.id, {
      name: result.name,
      snapshot: result.snapshot
    }));
  } catch (caught) {
    response.status(500).json({ error: caught instanceof Error ? caught.message : '同步店铺数据失败' });
  }
});

shopsRouter.post('/shops/:id/open-login', async (request, response) => {
  try {
    const profile = getShopAuthStorage(db, request.params.id);
    const requestedUrl = String(request.body?.url ?? '').trim();
    const url = requestedUrl.startsWith('https://fxg.jinritemai.com/')
      ? requestedUrl
      : undefined;
    const result = await openDoudianShopWindow(profile, url);
    response.json(result);
  } catch (caught) {
    response.status(500).json({ error: caught instanceof Error ? caught.message : '打开抖店失败' });
  }
});

shopsRouter.post('/shops/:id/save-cookies', async (request, response) => {
  try {
    const profile = getShopAuthStorage(db, request.params.id);
    const result = await saveDoudianShopCookies(profile);
    if (!result.saved) {
      response.status(409).json({ error: '没有找到该店铺已打开的登录窗口' });
      return;
    }

    updateShopStatus(db, request.params.id, 'active');
    response.json(result);
  } catch (caught) {
    response.status(500).json({ error: caught instanceof Error ? caught.message : '保存登录状态失败' });
  }
});

shopsRouter.post('/shops/:id/status', (request, response) => {
  const status = request.body?.status as ShopStatus;
  if (!['active', 'need_login', 'expired'].includes(status)) {
    response.status(400).json({ error: '无效的店铺状态' });
    return;
  }

  updateShopStatus(db, request.params.id, status);
  response.json({ ok: true });
});
