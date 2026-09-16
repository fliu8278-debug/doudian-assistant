import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sourceUrl = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-lgpl-shared.zip';
const vendorDirectory = join(process.cwd(), 'vendor', 'ffmpeg', 'win32-x64');
const executablePath = join(vendorDirectory, 'ffmpeg.exe');

if (existsSync(executablePath)) {
  console.log(`FFmpeg 已准备：${executablePath}`);
  process.exit(0);
}

const workDirectory = join(tmpdir(), `doudian-ffmpeg-${Date.now()}`);
const archivePath = join(workDirectory, 'ffmpeg.zip');
const extractDirectory = join(workDirectory, 'extract');

try {
  mkdirSync(extractDirectory, { recursive: true });
  console.log('正在下载 FFmpeg（首次约 74 MB）…');
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`下载失败：${response.status}`);
  writeFileSync(archivePath, new Uint8Array(await response.arrayBuffer()));
  execFileSync('tar', ['-xf', archivePath, '-C', extractDirectory], { stdio: 'inherit', windowsHide: true });

  const binDirectory = findDirectory(extractDirectory, 'ffmpeg.exe');
  if (!binDirectory) throw new Error('下载包中没有找到 ffmpeg.exe');
  mkdirSync(vendorDirectory, { recursive: true });
  cpSync(binDirectory, vendorDirectory, { recursive: true });
  console.log(`FFmpeg 已准备：${executablePath}`);
} finally {
  rmSync(workDirectory, { recursive: true, force: true });
}

function findDirectory(directory, name) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const candidate = join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === name) return directory;
    if (entry.isDirectory()) {
      const result = findDirectory(candidate, name);
      if (result) return result;
    }
  }
  return undefined;
}
