import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { bundledBrowserPath } from './browser.cjs';

describe('bundledBrowserPath', () => {
  it('uses Chromium shipped beside the packaged app', () => {
    expect(bundledBrowserPath('C:/Program Files/抖店助手/resources')).toBe(join(
      'C:/Program Files/抖店助手/resources', 'playwright', 'chromium', 'chrome-win64', 'chrome.exe'
    ));
  });
});
