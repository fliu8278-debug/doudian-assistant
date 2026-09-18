import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { AppDatabase } from './database';
import type { NewShop, Shop, ShopSnapshot, ShopStatus } from '../shared/types';
import { appDataPath } from '../paths';

type ShopRow = {
  id: string;
  name: string;
  remark: string;
  platform: 'doudian';
  official_account_name: string;
  status: ShopStatus;
  current: number;
  last_login_at: string | null;
  last_synced_at: string | null;
  snapshot_json: string;
  created_at: string;
};

type ShopAuthStorageRow = {
  shop_id: string;
  profile_path: string;
  cookie_path: string;
  status: ShopStatus;
  last_checked_at: string | null;
};

export type ShopAuthStorage = {
  shopId: string;
  profilePath: string;
  cookiePath: string;
  status: ShopStatus;
  lastCheckedAt: string | null;
};

export function createShop(db: AppDatabase, input: NewShop) {
  ensureShopColumns(db);
  ensureBrowserProfileColumns(db);
  const id = randomUUID();
  const now = new Date().toISOString();
  const hasCurrent = Boolean(
    db.prepare('select id from shops where current = 1 limit 1').get()
  );

  db.prepare(`
    insert into shops (
      id, name, remark, platform, official_account_name, status, current, last_login_at, last_synced_at, snapshot_json, created_at
    ) values (?, ?, ?, 'doudian', ?, 'need_login', ?, null, null, '{}', ?)
  `).run(
    id,
    input.name.trim(),
    input.remark.trim(),
    input.officialAccountName.trim(),
    hasCurrent ? 0 : 1,
    now
  );

  const profilePath = appDataPath('profiles', id);
  const cookiePath = appDataPath('cookies', `cookies_${id}.json`);
  mkdirSync(profilePath, { recursive: true });
  mkdirSync(dirname(cookiePath), { recursive: true });
  db.prepare(`
    insert into browser_profiles (
      id, shop_id, profile_path, cookie_path, status, last_checked_at, created_at
    ) values (?, ?, ?, ?, 'need_login', null, ?)
  `).run(randomUUID(), id, profilePath, cookiePath, now);

  return listShops(db).find((shop) => shop.id === id)!;
}

export function listShops(db: AppDatabase) {
  ensureShopColumns(db);
  ensureBrowserProfileColumns(db);
  return db
    .prepare('select * from shops order by current desc, created_at desc')
    .all()
    .map((row) => mapShop(row as ShopRow));
}

export function setCurrentShop(db: AppDatabase, shopId: string) {
  ensureShopColumns(db);
  ensureBrowserProfileColumns(db);
  db.exec('begin');
  try {
    db.prepare('update shops set current = 0').run();
    db.prepare('update shops set current = 1 where id = ?').run(shopId);
    db.exec('commit');
  } catch (error) {
    db.exec('rollback');
    throw error;
  }
}

export function deleteShop(db: AppDatabase, shopId: string) {
  ensureShopColumns(db);
  ensureBrowserProfileColumns(db);
  const shop = db.prepare('select current from shops where id = ?').get(shopId) as { current: number } | undefined;
  if (!shop) throw new Error(`店铺不存在: ${shopId}`);

  db.exec('begin');
  try {
    db.prepare('delete from shops where id = ?').run(shopId);
    if (shop.current) {
      db.prepare('update shops set current = 1 where id = (select id from shops order by created_at desc limit 1)').run();
    }
    db.exec('commit');
  } catch (error) {
    db.exec('rollback');
    throw error;
  }
}

export function updateShopStatus(
  db: AppDatabase,
  shopId: string,
  status: ShopStatus
) {
  ensureShopColumns(db);
  ensureBrowserProfileColumns(db);
  db.prepare('update shops set status = ? where id = ?').run(status, shopId);
  db.prepare('update browser_profiles set status = ?, last_checked_at = ? where shop_id = ?').run(
    status,
    new Date().toISOString(),
    shopId
  );
}

export function getShopAuthStorage(db: AppDatabase, shopId: string): ShopAuthStorage {
  ensureBrowserProfileColumns(db);
  const row = db
    .prepare('select shop_id, profile_path, cookie_path, status, last_checked_at from browser_profiles where shop_id = ?')
    .get(shopId) as ShopAuthStorageRow | undefined;

  if (!row) {
    throw new Error(`店铺浏览器登录态不存在: ${shopId}`);
  }

  return {
    shopId: row.shop_id,
    profilePath: row.profile_path,
    cookiePath: row.cookie_path || appDataPath('cookies', `cookies_${row.shop_id}.json`),
    status: row.status,
    lastCheckedAt: row.last_checked_at
  };
}

export function syncShopSnapshot(
  db: AppDatabase,
  input: {
    name: string;
    officialAccountName: string;
    snapshot: ShopSnapshot;
  }
) {
  ensureShopColumns(db);
  ensureBrowserProfileColumns(db);
  const now = new Date().toISOString();
  const existing = db
    .prepare('select id from shops where name = ? limit 1')
    .get(input.name.trim()) as { id: string } | undefined;

  if (!existing) {
    const shop = createShop(db, {
      name: input.name,
      officialAccountName: input.officialAccountName,
      remark: '从抖店后台同步'
    });
    setCurrentShop(db, shop.id);
    updateSyncedFields(db, shop.id, input.snapshot, now);
    return listShops(db).find((row) => row.id === shop.id)!;
  }

  setCurrentShop(db, existing.id);
  updateSyncedFields(db, existing.id, input.snapshot, now);
  return listShops(db).find((row) => row.id === existing.id)!;
}

export function updateShopSnapshot(
  db: AppDatabase,
  shopId: string,
  input: {
    name?: string;
    officialAccountName?: string;
    snapshot: ShopSnapshot;
  }
) {
  ensureShopColumns(db);
  ensureBrowserProfileColumns(db);
  const now = new Date().toISOString();
  const current = listShops(db).find((shop) => shop.id === shopId);
  if (!current) throw new Error(`店铺不存在: ${shopId}`);

  db.prepare(`
    update shops
    set name = ?,
        official_account_name = ?,
        status = 'active',
        last_login_at = ?,
        last_synced_at = ?,
        snapshot_json = ?
    where id = ?
  `).run(
    input.name?.trim() || current.name,
    input.officialAccountName?.trim() || current.officialAccountName,
    now,
    now,
    JSON.stringify(input.snapshot),
    shopId
  );
  db.prepare(`
    update browser_profiles
    set status = 'active', last_checked_at = ?
    where shop_id = ?
  `).run(now, shopId);

  return listShops(db).find((shop) => shop.id === shopId)!;
}

function updateSyncedFields(
  db: AppDatabase,
  shopId: string,
  snapshot: ShopSnapshot,
  syncedAt: string
) {
  db.prepare(`
    update shops
    set status = 'active',
        last_login_at = ?,
        last_synced_at = ?,
        snapshot_json = ?
    where id = ?
  `).run(syncedAt, syncedAt, JSON.stringify(snapshot), shopId);
  db.prepare(`
    update browser_profiles
    set status = 'active', last_checked_at = ?
    where shop_id = ?
  `).run(syncedAt, shopId);
}

function mapShop(row: ShopRow): Shop {
  return {
    id: row.id,
    name: row.name,
    remark: row.remark,
    platform: row.platform,
    officialAccountName: row.official_account_name,
    status: row.status,
    current: row.current === 1,
    lastLoginAt: row.last_login_at,
    lastSyncedAt: row.last_synced_at,
    snapshot: parseSnapshot(row.snapshot_json),
    createdAt: row.created_at
  };
}

function parseSnapshot(value: string): ShopSnapshot {
  try {
    return JSON.parse(value) as ShopSnapshot;
  } catch {
    return {};
  }
}

function ensureShopColumns(db: AppDatabase) {
  const columns = db
    .prepare('pragma table_info(shops)')
    .all()
    .map((row) => (row as { name: string }).name);

  if (!columns.includes('last_synced_at')) {
    db.prepare('alter table shops add column last_synced_at text').run();
  }
  if (!columns.includes('snapshot_json')) {
    db.prepare("alter table shops add column snapshot_json text not null default '{}'").run();
  }
}

function ensureBrowserProfileColumns(db: AppDatabase) {
  const columns = db
    .prepare('pragma table_info(browser_profiles)')
    .all()
    .map((row) => (row as { name: string }).name);

  if (!columns.includes('cookie_path')) {
    db.prepare("alter table browser_profiles add column cookie_path text not null default ''").run();
  }
}
