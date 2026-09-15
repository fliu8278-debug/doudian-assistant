import { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { appDataPath } from '../paths';

export type AppDatabase = DatabaseSync;

export function openDatabase(filePath = appDataPath('app.sqlite')) {
  mkdirSync(dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath);
  db.exec('pragma foreign_keys = on');
  db.exec(schema);
  return db;
}

const schema = `
create table if not exists shops (
  id text primary key,
  name text not null,
  remark text not null default '',
  platform text not null default 'doudian',
  official_account_name text not null,
  status text not null default 'need_login',
  current integer not null default 0,
  last_login_at text,
  last_synced_at text,
  snapshot_json text not null default '{}',
  created_at text not null
);

create table if not exists browser_profiles (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  profile_path text not null,
  cookie_path text not null,
  status text not null default 'need_login',
  last_checked_at text,
  created_at text not null
);

create table if not exists coupon_batches (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  file_name text not null,
  total_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'pending',
  created_at text not null
);

create table if not exists coupon_tasks (
  id text primary key,
  batch_id text references coupon_batches(id) on delete cascade,
  shop_id text not null references shops(id) on delete cascade,
  sku text not null,
  coupon_name text not null,
  product_search_keyword text not null default '',
  start_time text not null,
  end_time text not null,
  valid_days integer not null,
  threshold_amount real not null,
  discount_amount real not null,
  issue_amount_type text not null default 'unlimited',
  per_user_limit text not null default 'unlimited',
  goods_scope text not null default 'specified',
  status text not null default 'pending',
  error_message text,
  screenshot_path text,
  created_at text not null,
  updated_at text not null
);

create table if not exists newcomer_gift_batches (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  file_name text not null,
  total_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'pending',
  created_at text not null
);

create table if not exists newcomer_gift_tasks (
  id text primary key,
  batch_id text references newcomer_gift_batches(id) on delete cascade,
  shop_id text not null references shops(id) on delete cascade,
  sku text not null,
  activity_name text not null,
  product_search_keyword text not null default '',
  start_time text not null,
  end_time text not null,
  discount_amount real not null,
  status text not null default 'pending',
  error_message text,
  screenshot_path text,
  created_at text not null,
  updated_at text not null
);

create table if not exists task_logs (
  id text primary key,
  task_id text references coupon_tasks(id) on delete cascade,
  level text not null,
  message text not null,
  created_at text not null
);

create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at text not null
);
`;
