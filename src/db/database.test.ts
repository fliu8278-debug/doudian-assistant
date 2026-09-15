import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from './database';
import { createShop, getShopAuthStorage, listShops, setCurrentShop, syncShopSnapshot } from './shops';

let tempDir = '';
let db: DatabaseSync | null = null;

afterEach(() => {
  db?.close();
  db = null;
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = '';
});

function testDbPath() {
  tempDir = mkdtempSync(join(tmpdir(), 'doudian-tool-'));
  return join(tempDir, 'app.sqlite');
}

describe('database', () => {
  it('creates the required tables', () => {
    db = openDatabase(testDbPath());

    const tables = db
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row) => row.name);

    expect(tables).toContain('shops');
    expect(tables).toContain('browser_profiles');
    expect(tables).toContain('coupon_batches');
    expect(tables).toContain('coupon_tasks');
    expect(tables).toContain('newcomer_gift_batches');
    expect(tables).toContain('newcomer_gift_tasks');
    expect(tables).toContain('task_logs');
    expect(tables).toContain('settings');
  });

  it('creates shops and keeps one current shop', () => {
    db = openDatabase(testDbPath());

    const first = createShop(db, {
      name: '斯凯奇旗舰店',
      remark: '主店',
      officialAccountName: '店铺官方号'
    });
    const second = createShop(db, {
      name: '测试店铺',
      remark: '',
      officialAccountName: '子账号'
    });

    setCurrentShop(db, second.id);
    const shops = listShops(db);

    expect(shops).toHaveLength(2);
    expect(shops.find((shop) => shop.id === first.id)?.current).toBe(false);
    expect(shops.find((shop) => shop.id === second.id)?.current).toBe(true);
  });

  it('creates separate profile and cookie storage for each shop', () => {
    db = openDatabase(testDbPath());

    const first = createShop(db, {
      name: '斯凯奇旗舰店',
      remark: '主店',
      officialAccountName: '店铺官方号'
    });
    const second = createShop(db, {
      name: '测试店铺',
      remark: '',
      officialAccountName: '子账号'
    });

    const firstAuth = getShopAuthStorage(db, first.id);
    const secondAuth = getShopAuthStorage(db, second.id);

    expect(firstAuth.profilePath).toContain(first.id);
    expect(firstAuth.cookiePath).toBe(join('data', 'cookies', `cookies_${first.id}.json`));
    expect(secondAuth.cookiePath).toBe(join('data', 'cookies', `cookies_${second.id}.json`));
    expect(firstAuth.cookiePath).not.toBe(secondAuth.cookiePath);
  });

  it('syncs a logged-in shop snapshot', () => {
    db = openDatabase(testDbPath());

    const shop = syncShopSnapshot(db, {
      name: '斯凯奇SKECHERS斯凯彻斯运动鞋专卖店',
      officialAccountName: '店铺官方号',
      snapshot: {
        pendingShipment: '1',
        pendingAfterSale: '7',
        revenueAmount: '¥598.00',
        orderCount: '2',
        experienceScore: '91'
      }
    });

    expect(shop.status).toBe('active');
    expect(shop.current).toBe(true);
    expect(shop.snapshot).toMatchObject({
      pendingShipment: '1',
      revenueAmount: '¥598.00',
      experienceScore: '91'
    });
    expect(shop.lastSyncedAt).toEqual(expect.any(String));
  });
});
