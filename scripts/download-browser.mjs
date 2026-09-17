import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = join(process.cwd(), 'vendor', 'playwright');
const browserDirectory = join(root, 'chromium');
const executablePath = join(browserDirectory, 'chrome-win64', 'chrome.exe');

if (existsSync(executablePath)) {
  console.log(`Chromium 已准备：${executablePath}`);
  process.exit(0);
}

mkdirSync(root, { recursive: true });
const result = spawnSync(process.execPath, [join(process.cwd(), 'node_modules', 'playwright', 'cli.js'), 'install', 'chromium'], {
  cwd: process.cwd(),
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: root },
  stdio: 'inherit'
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const downloaded = readdirSync(root).find((name) => /^chromium-\d+$/.test(name));
if (!downloaded) throw new Error('Playwright Chromium 下载完成后未找到浏览器文件。');
renameSync(join(root, downloaded), browserDirectory);

if (!existsSync(executablePath)) throw new Error(`Chromium 文件不完整：${executablePath}`);
console.log(`Chromium 已准备：${executablePath}`);
