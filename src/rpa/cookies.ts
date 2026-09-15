import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BrowserContext } from 'playwright';

export type StoredCookie = Parameters<BrowserContext['addCookies']>[0][number];

export function readCookieFile(path: string): StoredCookie[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isFile()) return [];

  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
  if (!Array.isArray(parsed)) return [];

  return parsed.filter((cookie): cookie is StoredCookie => (
    Boolean(cookie) &&
    typeof cookie === 'object' &&
    typeof (cookie as { name?: unknown }).name === 'string' &&
    typeof (cookie as { value?: unknown }).value === 'string'
  ));
}

export function writeCookieFile(path: string, cookies: readonly StoredCookie[]) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && !statSync(path).isFile()) {
    throw new Error(`Cookie 保存路径不是文件：${path}`);
  }
  writeFileSync(path, JSON.stringify(cookies, null, 2), 'utf-8');
}
