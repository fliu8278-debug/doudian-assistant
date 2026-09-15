import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readCookieFile, writeCookieFile } from './cookies';

let tempDir = '';

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  tempDir = '';
});

function tempPath() {
  tempDir = mkdtempSync(join(tmpdir(), 'doudian-cookies-'));
  return join(tempDir, 'nested', 'cookies_shop.json');
}

describe('cookie files', () => {
  it('returns an empty list when a cookie file does not exist', () => {
    expect(readCookieFile(tempPath())).toEqual([]);
  });

  it('writes and reads a shop cookie file', () => {
    const path = tempPath();
    const cookies = [{ name: 'sessionid', value: 'abc', domain: '.jinritemai.com', path: '/' }];

    writeCookieFile(path, cookies);

    expect(existsSync(path)).toBe(true);
    expect(readCookieFile(path)).toEqual(cookies);
  });
});
