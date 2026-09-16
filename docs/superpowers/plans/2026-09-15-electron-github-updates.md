# Electron GitHub 自动更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Windows 版抖店助手增加经代码签名验证的 GitHub Releases 更新机制，并提供发布工作流。

**Architecture:** 新建可注入依赖的 CommonJS 更新模块，由现有 Electron 主进程仅在打包环境调用。私有源码仓库使用 GitHub Actions 构建、签名，并将安装包和 `latest.yml` 发布到公开的 `doudian-assistant-releases` 仓库；应用只从该公开仓库检查更新。

**Tech Stack:** Electron 44、electron-builder 26、electron-updater 6、GitHub Actions、Windows NSIS。

---

## File Structure

- Create: `electron/updater.cjs` — 更新检查、下载和用户确认流程。
- Create: `electron/updater.test.ts` — 更新模块单元测试。
- Modify: `electron/main.cjs` — 在应用窗口创建后启动更新模块。
- Modify: `package.json` — 增加运行时依赖、发布脚本与公开发布仓库配置。
- Modify: `package-lock.json` — 锁定 `electron-updater` 依赖。
- Create: `.github/workflows/release.yml` — 基于 `v*` 标签的签名 Windows 发布工作流。
- Create: `docs/release.md` — GitHub 仓库、Secrets、签名证书和发布步骤。
- Modify: `docs/superpowers/plans/2026-09-15-electron-github-updates.md` — 勾选完成步骤。

### Task 1: 测试优先实现客户端更新流程

**Files:**
- Create: `electron/updater.test.ts`
- Create: `electron/updater.cjs`

- [x] **Step 1: 写入更新模块的失败测试**

创建 `electron/updater.test.ts`：

```js
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { startAutoUpdater } from './updater.cjs';

function createUpdater() {
  const updater = new EventEmitter();
  updater.checkForUpdates = vi.fn().mockResolvedValue();
  updater.downloadUpdate = vi.fn().mockResolvedValue();
  updater.quitAndInstall = vi.fn();
  return updater;
}

describe('startAutoUpdater', () => {
  it('在开发环境不检查更新', () => {
    const autoUpdater = createUpdater();

    startAutoUpdater({
      app: { isPackaged: false },
      autoUpdater,
      dialog: { showMessageBox: vi.fn() },
      getWindow: () => undefined,
      log: { error: vi.fn() }
    });

    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('在打包环境检查更新并在用户确认后下载和安装', async () => {
    const autoUpdater = createUpdater();
    const dialog = { showMessageBox: vi.fn().mockResolvedValue({ response: 0 }) };

    startAutoUpdater({
      app: { isPackaged: true },
      autoUpdater,
      dialog,
      getWindow: () => ({ id: 1 }),
      log: { error: vi.fn() }
    });
    autoUpdater.emit('update-available', { version: '0.2.0' });
    await new Promise(setImmediate);
    autoUpdater.emit('update-downloaded');
    await new Promise(setImmediate);

    expect(autoUpdater.autoDownload).toBe(false);
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce();
    expect(autoUpdater.downloadUpdate).toHaveBeenCalledOnce();
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce();
  });
});
```

Run: `npm test -- electron/updater.test.ts`

Expected: FAIL with `Cannot find module './updater.cjs'`.

- [x] **Step 2: 实现最小更新模块**

创建 `electron/updater.cjs`：

```js
function startAutoUpdater({ app, autoUpdater, dialog, getWindow, log = console }) {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.on('update-available', async ({ version }) => {
    const { response } = await dialog.showMessageBox(getWindow(), {
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 v${version}`,
      detail: '下载完成后，你可以选择重启软件安装更新。',
      buttons: ['立即更新', '稍后'],
      defaultId: 0,
      cancelId: 1
    });
    if (response === 0) await autoUpdater.downloadUpdate();
  });
  autoUpdater.on('update-downloaded', async () => {
    const { response } = await dialog.showMessageBox(getWindow(), {
      type: 'info',
      title: '更新已下载',
      message: '更新已下载完成。',
      detail: '重启软件后将完成安装。',
      buttons: ['重启安装', '稍后'],
      defaultId: 0,
      cancelId: 1
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', (error) => log.error('更新检查失败', error));
  autoUpdater.checkForUpdates().catch((error) => log.error('更新检查失败', error));
}

module.exports = { startAutoUpdater };
```

- [x] **Step 3: 验证测试转绿**

Run: `npm test -- electron/updater.test.ts`

Expected: 2 tests pass。

### Task 2: 接入 Electron 与发布依赖

**Files:**
- Modify: `electron/main.cjs`
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] **Step 1: 安装更新依赖**

Run: `npm install electron-updater@^6.8.9`

Expected: `package.json` 的 `dependencies` 出现 `electron-updater`，且 `package-lock.json` 更新。

- [x] **Step 2: 让主进程在窗口创建后启动更新检查**

在 `electron/main.cjs` 顶部增加：

```js
const { autoUpdater } = require('electron-updater');
const { startAutoUpdater } = require('./updater.cjs');
```

并在 `createWindow(started.url);` 后增加：

```js
startAutoUpdater({
  app,
  autoUpdater,
  dialog,
  getWindow: () => mainWindow
});
```

- [x] **Step 3: 添加显式发布配置**

在 `package.json` 顶层增加：

```json
"repository": {
  "type": "git",
  "url": "https://github.com/fliu8278-debug/doudian-assistant.git"
}
```

将脚本替换为：

```json
"dist:win": "npm run build && electron-builder --win nsis --x64 --publish never",
"release:win": "npm run build && electron-builder --win nsis --x64 --publish always"
```

并在 `build` 对象中增加：

```json
"publish": [{
  "provider": "github",
  "owner": "fliu8278-debug",
  "repo": "doudian-assistant-releases",
  "releaseType": "release"
}]
```

保留现有 NSIS 目标，并在 `win` 对象中增加：

```json
"verifyUpdateCodeSignature": true
```

- [x] **Step 4: 运行更新测试、类型检查与构建**

Run: `npm test -- electron/updater.test.ts && npm run typecheck && npm run build`

Expected: 命令全部 exit code 0。

### Task 3: 添加受签名保护的 GitHub Release 工作流

**Files:**
- Create: `.github/workflows/release.yml`
- Create: `docs/release.md`

- [x] **Step 1: 创建标签触发的 Windows 发布工作流**

创建 `.github/workflows/release.yml`：

```yaml
name: Release Windows

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: read

jobs:
  release:
    runs-on: windows-latest
    env:
      GH_TOKEN: ${{ secrets.GH_RELEASE_TOKEN }}
      WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
      WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run typecheck
      - name: Verify release configuration
        shell: pwsh
        run: |
          $missing = 'GH_TOKEN', 'WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD' | Where-Object {
            [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_))
          }
          if ($missing) { throw "Missing required release secrets: $($missing -join ', ')" }
          $tagVersion = $env:GITHUB_REF_NAME.Substring(1)
          $packageVersion = node -p "require('./package.json').version"
          if ($tagVersion -ne $packageVersion) {
            throw "Tag version $tagVersion does not match package version $packageVersion"
          }
      - run: npm run release:win
```

- [x] **Step 2: 编写发布操作说明**

创建 `docs/release.md`，说明：

1. 创建公开空仓库 `fliu8278-debug/doudian-assistant-releases`，不上传源码。
2. 创建仅有该发布仓库 Contents 读写权限的 Fine-grained token，并将其保存为私有源码仓库的 `GH_RELEASE_TOKEN` Secret。
3. 将签名证书和密码保存为 `WIN_CSC_LINK`、`WIN_CSC_KEY_PASSWORD` Secrets。
4. 修改 `package.json` 版本，执行 `npm test`、`npm run typecheck`、`npm run dist:win`。
5. 用户检查本地安装包后，提交、推送 `main`，创建并推送同版本的 `v<version>` 标签。
6. 在 Actions 中确认发布成功，并检查公开 Releases 中包含 `.exe` 与 `latest.yml`。

- [x] **Step 3: 验证工作流与说明被纳入构建产物之外的源码**

Run: `git check-ignore .github/workflows/release.yml docs/release.md; git diff --check`

Expected: 第一条命令没有输出且 exit code 1；第二条命令 exit code 0。

### Task 4: 完整验证与本地预览

**Files:**
- Modify: `electron/main.cjs`
- Create: `electron/updater.cjs`
- Create: `electron/updater.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `.github/workflows/release.yml`
- Create: `docs/release.md`

- [x] **Step 1: 运行完整质量检查**

Run: `npm test && npm run typecheck && npm run build`

Expected: 所有测试、类型检查和生产构建通过。

- [ ] **Step 2: 构建但不发布 Windows 安装包**

Run: `npm run dist:win`

Expected: Windows NSIS 安装包生成到已忽略的 `release/`，且不会请求 GitHub 发布。

> 验证记录：2026-09-15 已进入 electron-builder 打包阶段，但下载构建依赖时网络连接 GitHub 超时；待网络恢复后重试，不影响源码测试与前端预览。

- [x] **Step 3: 启动本地预览供用户检查**

Run: `npm run app`

Expected: 本地桌面软件启动；因为不是已发布安装包，不会检查远程更新。用户确认后才提交和推送。

- [ ] **Step 4: 提交但不推送，等待用户检查确认**

```bash
git add electron/updater.cjs electron/updater.test.ts electron/main.cjs package.json package-lock.json .github/workflows/release.yml docs/release.md docs/superpowers/plans/2026-09-15-electron-github-updates.md
git commit -m "feat: add signed GitHub auto updates"
```

Do not run `git push` until the user confirms the local preview.

## Self-Review

- Spec coverage: 客户端确认、公开发布仓库、私有源码、签名门槛、版本标签工作流、故障不阻止启动及用户预览门槛均有对应任务。
- Placeholder scan: 不含 TBD、TODO 或未定义接口。
- Type consistency: 发布仓库名、Secret 名称、`startAutoUpdater` 与发布脚本在全部任务中保持一致。
