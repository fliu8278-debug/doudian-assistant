import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launchShopContext } from './doudianSession';

let tempDir = '';

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = '';
});

describe('店铺浏览器启动', () => {
  it('uses a separate runtime profile when the saved profile is occupied', async () => {
    const paths: string[] = [];
    const context = {} as Awaited<ReturnType<typeof launchShopContext>>;
    const launch = async (profilePath: string) => {
      paths.push(profilePath);
      if (paths.length === 1) throw new Error('profile is already in use');
      return context;
    };

    await expect(launchShopContext({
      shopId: 'shop-1',
      profilePath: 'C:/saved-profile',
      cookiePath: 'C:/cookies.json'
    }, false, launch)).resolves.toBe(context);
    expect(paths[0]).toBe('C:/saved-profile');
    expect(paths[1]).toMatch(/[\\/]runtime-profiles[\\/]shop-1$/);
  });

  it('does not overwrite a persistent profile with the cookie file', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'doudian-session-'));
    const cookiePath = join(tempDir, 'cookies.json');
    writeFileSync(cookiePath, JSON.stringify([{ name: 'sessionid', value: 'stale', domain: '.jinritemai.com', path: '/' }]));
    const added: unknown[] = [];
    const context = { addCookies: async (cookies: unknown[]) => added.push(cookies) } as never;

    await launchShopContext({ shopId: 'shop-1', profilePath: join(tempDir, 'profile'), cookiePath }, false, async () => context);

    expect(added).toEqual([]);
  });

  it('loads the cookie file only in the fallback runtime profile', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'doudian-session-'));
    const cookiePath = join(tempDir, 'cookies.json');
    writeFileSync(cookiePath, JSON.stringify([{ name: 'sessionid', value: 'saved', domain: '.jinritemai.com', path: '/' }]));
    const added: unknown[] = [];
    const context = { addCookies: async (cookies: unknown[]) => added.push(cookies) } as never;
    let attempts = 0;

    await launchShopContext({ shopId: 'shop-1', profilePath: join(tempDir, 'profile'), cookiePath }, false, async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('profile is already in use');
      return context;
    });

    expect(added).toHaveLength(1);
  });
});
