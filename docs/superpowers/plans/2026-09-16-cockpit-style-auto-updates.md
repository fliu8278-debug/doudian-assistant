# Cockpit 风格桌面更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Windows 版抖店助手实现软件内检查、下载进度、重启安装和 GitHub Release 回退的完整更新体验。

**Architecture:** Electron 主进程持有唯一的 `electron-updater` 状态机，并通过 context-isolated preload IPC 向 React 提供受限 API。React 使用一个更新状态 hook 驱动侧边栏动作、设置卡片和更新弹窗。GitHub Actions 只在全部 NSIS 产物上传到公开发布仓库后将 Release 标记为 latest。

**Tech Stack:** Electron 44、electron-updater、Electron IPC、React 19、Vitest、electron-builder、GitHub Actions。

---

## 文件结构

- Create: `electron/preload.cjs` — 仅暴露更新 IPC API。
- Modify: `electron/main.cjs` — 注册 IPC、创建 preload 窗口配置、初始化更新协调器。
- Modify: `electron/updater.cjs` — updater 状态机、下载、重启、设置持久化和 Release 链接。
- Modify: `electron/updater.test.ts` — 主进程状态机的行为测试。
- Create: `src/app/updater.ts` — 浏览器侧类型、状态 hook 和安全的非 Electron 回退。
- Create: `src/app/updater.test.ts` — 更新状态映射和命令测试。
- Create: `src/app/components/UpdateDialog.tsx` — 版本说明、进度、重试、重启操作。
- Modify: `src/app/App.tsx` — 侧边栏更新动作、设置页面的更新卡片及弹窗挂载。
- Modify: `src/app/styles.css` — 更新按钮、卡片、弹窗和右下角完成提示样式。
- Modify: `src/app/App.test.tsx` — 更新入口和设置卡片渲染测试。
- Modify: `package.json` — 发布源改为公开发布仓库，加入 draft Release 配置。
- Modify: `.github/workflows/release.yml` — 先 draft、构建上传、最后发布 latest。
- Modify: `docs/release.md` — 公开发布仓库、Secrets、测试机更新流程。

### Task 1: 建立可测试的主进程更新状态机

**Files:**
- Modify: `electron/updater.cjs`
- Modify: `electron/updater.test.ts`

- [ ] **Step 1: 写失败测试，定义更新状态与进度事件**

在 `electron/updater.test.ts` 新增测试：

```js
it('publishes downloading progress and a ready state', async () => {
  const updater = createUpdater();
  const coordinator = startAutoUpdater({ app: { isPackaged: true }, autoUpdater: updater, shell, store, broadcast, log });

  updater.emit('update-available', { version: '0.1.2', releaseNotes: '修复视频预览' });
  await coordinator.download();
  updater.emit('download-progress', { percent: 42, transferred: 42, total: 100 });
  updater.emit('update-downloaded', { version: '0.1.2', releaseNotes: '修复视频预览' });

  expect(broadcast).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'ready', version: '0.1.2' }));
  expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行测试，确认失败原因是尚未公开 coordinator 与状态**

Run: `npm test -- electron/updater.test.ts`

Expected: FAIL，指出 `coordinator.download` 或 `phase` 尚不存在。

- [ ] **Step 3: 实现最小状态协调器**

在 `electron/updater.cjs` 使用如下单一状态形状，并让所有 `electron-updater` 事件通过 `publish()` 广播：

```js
const idleState = { phase: 'idle', currentVersion: app.getVersion(), backgroundEnabled: false };
// phase: idle | checking | available | downloading | ready | not-available | error

function publish(next) {
  state = { ...state, ...next };
  broadcast(state);
  return state;
}

async function download() {
  publish({ phase: 'downloading', error: undefined });
  await autoUpdater.downloadUpdate();
}

function restart() {
  if (state.phase === 'ready') autoUpdater.quitAndInstall();
}
```

更新可用事件保留 `version`、`releaseNotes` 与 `releaseUrl`；下载进度保留 `percent`、`transferred` 与 `total`。`error` 事件转为中文通俗信息，完整错误只传给 `log.error`。

- [ ] **Step 4: 运行测试，确认转绿**

Run: `npm test -- electron/updater.test.ts`

Expected: PASS，所有现有 updater 测试和新增状态测试通过。

- [ ] **Step 5: 提交主进程状态机**

```powershell
git add electron/updater.cjs electron/updater.test.ts
git commit -m "feat: expose updater lifecycle state"
```

### Task 2: 通过 preload 安全连接 React 与更新器

**Files:**
- Create: `electron/preload.cjs`
- Modify: `electron/main.cjs`
- Modify: `electron/updater.cjs`
- Modify: `electron/updater.test.ts`

- [ ] **Step 1: 写失败测试，定义 IPC 可调用命令**

在 updater 测试中以 mock `ipcMain` 验证只注册以下通道：

```js
expect(ipcMain.handle).toHaveBeenCalledWith('updater:get-state', expect.any(Function));
expect(ipcMain.handle).toHaveBeenCalledWith('updater:check', expect.any(Function));
expect(ipcMain.handle).toHaveBeenCalledWith('updater:download', expect.any(Function));
expect(ipcMain.handle).toHaveBeenCalledWith('updater:restart', expect.any(Function));
expect(ipcMain.handle).toHaveBeenCalledWith('updater:set-background', expect.any(Function));
```

- [ ] **Step 2: 运行测试，确认 IPC 注册尚不存在**

Run: `npm test -- electron/updater.test.ts`

Expected: FAIL，`ipcMain.handle` 未被调用。

- [ ] **Step 3: 实现 preload 与 IPC 注册**

创建 `electron/preload.cjs`，只暴露如下 API：

```js
contextBridge.exposeInMainWorld('doudianUpdater', {
  getState: () => ipcRenderer.invoke('updater:get-state'),
  check: () => ipcRenderer.invoke('updater:check'),
  download: () => ipcRenderer.invoke('updater:download'),
  restart: () => ipcRenderer.invoke('updater:restart'),
  setBackground: (enabled) => ipcRenderer.invoke('updater:set-background', Boolean(enabled)),
  openRelease: () => ipcRenderer.invoke('updater:open-release'),
  onState: (listener) => {
    const receive = (_event, state) => listener(state);
    ipcRenderer.on('updater:state', receive);
    return () => ipcRenderer.removeListener('updater:state', receive);
  }
});
```

在 `electron/main.cjs` 使用 `preload: path.join(__dirname, 'preload.cjs')`，并将 `webContents.send('updater:state', state)` 作为 Task 1 的 broadcast。主进程在开发模式拒绝检查/下载并只返回 `idle`，保持网页开发服务器可用。

- [ ] **Step 4: 运行测试，确认 IPC 注册与开发回退通过**

Run: `npm test -- electron/updater.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交 IPC 桥接**

```powershell
git add electron/preload.cjs electron/main.cjs electron/updater.cjs electron/updater.test.ts
git commit -m "feat: bridge updater state to renderer"
```

### Task 3: 添加浏览器侧状态 hook 与应用内更新弹窗

**Files:**
- Create: `src/app/updater.ts`
- Create: `src/app/updater.test.ts`
- Create: `src/app/components/UpdateDialog.tsx`

- [ ] **Step 1: 写失败测试，固定非桌面与下载状态行为**

```ts
it('keeps browser previews idle without an Electron bridge', async () => {
  expect(await readInitialUpdateState(undefined)).toMatchObject({ phase: 'idle', currentVersion: '开发预览' });
});

it('formats update progress for the dialog', () => {
  expect(updateActionLabel({ phase: 'downloading', percent: 42 })).toBe('下载中 42%');
  expect(updateActionLabel({ phase: 'ready' })).toBe('重启更新');
});
```

- [ ] **Step 2: 运行测试，确认模块不存在**

Run: `npm test -- src/app/updater.test.ts`

Expected: FAIL，提示无法解析 `./updater`。

- [ ] **Step 3: 实现类型、hook 与弹窗**

在 `src/app/updater.ts` 定义 `UpdatePhase`、`UpdateState`、`window.doudianUpdater` 类型和 `useUpdater()`。hook 初次调用 `getState()`，订阅 `onState()`，并在 API 不存在时返回开发预览的 idle 状态。

在 `UpdateDialog.tsx` 按 phase 渲染：

```tsx
{state.phase === 'available' ? <button onClick={onDownload}>立即更新</button> : null}
{state.phase === 'downloading' ? <progress max={100} value={state.percent ?? 0} /> : null}
{state.phase === 'ready' ? <button onClick={onRestart}>重启更新</button> : null}
{state.phase === 'error' ? <><button onClick={onRetry}>重试</button><button onClick={onOpenRelease}>打开下载页</button></> : null}
```

更新说明只以纯文本渲染；下载中禁用重复下载按钮。

- [ ] **Step 4: 运行浏览器状态测试**

Run: `npm test -- src/app/updater.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交渲染层更新模块**

```powershell
git add src/app/updater.ts src/app/updater.test.ts src/app/components/UpdateDialog.tsx
git commit -m "feat: add in-app update dialog"
```

### Task 4: 复刻侧边栏、设置页和完成提示入口

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/styles.css`
- Modify: `src/app/App.test.tsx`

- [ ] **Step 1: 写失败渲染测试**

在 `src/app/App.test.tsx` 新增：

```tsx
it('renders a Cockpit-style update action above sidebar navigation', () => {
  const markup = renderToStaticMarkup(<App />);
  expect(markup).toContain('检查更新');
  expect(markup).toContain('软件更新');
});
```

- [ ] **Step 2: 运行测试，确认入口尚不存在**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL，未找到“检查更新”。

- [ ] **Step 3: 将更新器接入现有 App**

在 `App` 顶层调用 `useUpdater()`；在品牌下、主导航前放置更新动作，标签由 `updateActionLabel(state)` 决定。点击时：`idle/not-available/error` 调用 `check()`，`available` 打开弹窗，`ready` 调用 `restart()`。

将现有 `settings` placeholder 替换为 `SettingsWorkbench`，其中包含“软件更新”卡片：当前版本、检查更新按钮、后台自动下载 checkbox 和“查看更新说明”按钮。弹窗在 `App` 根部渲染，避免被页面布局裁切。`ready` 时在右下角显示“更新已准备好”提示及“重启更新”按钮。

在 `styles.css` 添加 `sidebarUpdateAction`、`updateCard`、`updateDialog`、`updateProgress` 和 `updateReadyToast`，复用当前侧边栏的白底、紧凑圆角和蓝色 active 状态，不引入 UI 依赖。

- [ ] **Step 4: 运行渲染测试与类型检查**

Run: `npm test -- src/app/App.test.tsx src/app/updater.test.ts && npm run typecheck`

Expected: PASS，TypeScript 不报 `window.doudianUpdater` 类型错误。

- [ ] **Step 5: 提交完整更新界面**

```powershell
git add src/app/App.tsx src/app/styles.css src/app/App.test.tsx
git commit -m "feat: add cockpit-style update controls"
```

### Task 5: 完成可用的 GitHub Release 更新源

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/release.yml`
- Modify: `docs/release.md`

- [ ] **Step 1: 写发布配置断言**

在 `electron/updater.test.ts` 中读取 `package.json`，断言发布源不是源码私有仓库，并包含 GitHub provider：

```js
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
expect(packageJson.build.publish[0]).toMatchObject({ provider: 'github', repo: 'doudian-assistant-releases' });
```

- [ ] **Step 2: 运行测试，确认当前发布目标不符合公开发布源约束**

Run: `npm test -- electron/updater.test.ts`

Expected: FAIL，当前 `repo` 是 `doudian-assistant`。

- [ ] **Step 3: 配置发布与发布工作流**

将 `package.json` 的 GitHub 发布目标改回 `fliu8278-debug/doudian-assistant-releases`，并仅在该仓库存在且为公开仓库后创建新版本标签。

在 `release.yml` 使用 draft Release：构建前调用 `gh release create "$env:GITHUB_REF_NAME" --repo fliu8278-debug/doudian-assistant-releases --draft --title "抖店助手 $env:GITHUB_REF_NAME" --generate-notes`，执行 `npm run release:win` 上传 `.exe`、`.blockmap` 与 `latest.yml`，成功后调用 `gh release edit "$env:GITHUB_REF_NAME" --repo fliu8278-debug/doudian-assistant-releases --draft=false --latest`。`GH_TOKEN` 仍只允许写公开发布仓库。

在 `docs/release.md` 删除“同源码仓库发布”的说明，明确首次用户必须手工安装包含 updater 的版本；后续版本通过 GitHub Release 更新。

- [ ] **Step 4: 运行发布配置测试、全量测试和构建**

Run: `npm test && npm run build`

Expected: PASS；构建生成 Electron 所需的静态页面与 server bundle。

- [ ] **Step 5: 提交发布链路配置**

```powershell
git add package.json .github/workflows/release.yml docs/release.md electron/updater.test.ts
git commit -m "build: publish updater releases safely"
```

### Task 6: 真实发布与更新回归

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: 确认外部发布条件**

在 GitHub 创建公开空仓库 `fliu8278-debug/doudian-assistant-releases`，并在源码仓库的 Actions Secrets 配置 `GH_RELEASE_TOKEN`、`WIN_CSC_LINK` 和 `WIN_CSC_KEY_PASSWORD`。这些敏感值不得在终端回显或写入任何文件。

- [ ] **Step 2: 递增版本、完整测试、构建本地候选包**

将 `package.json` 与 `package-lock.json` 同步升至下一个未发布版本，运行：

```powershell
npm test
npm run build
npm run dist:win
```

Expected: 全部 exit 0，NSIS 安装包包含 `electron-updater`、preload 和内置 FFmpeg。

- [ ] **Step 3: 在测试机执行升级测试**

先安装版本 N，再发布 N+1。启动版本 N，验证侧边栏出现更新动作、弹窗进度会增长、点击“重启更新”后应用变为 N+1，且首次启动显示 Release 说明。

- [ ] **Step 4: 验证失败回退**

临时阻断网络，点击“检查更新”；验证应用仍可正常操作，弹窗展示“重试”和“打开下载页”，且不泄露 token 或签名信息。

- [ ] **Step 5: 推送已验证版本标签**

```powershell
git push origin main
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

仅在用户确认本地候选包和 GitHub Actions 发布均正常后执行。

## 自检

- 规格中的侧边栏、设置、更新弹窗、后台模式、下载进度、重启、失败回退、发布与测试机验证分别由 Task 1–6 覆盖。
- 任务名称、文件名和 `UpdateState` 的 phase 在全部步骤保持一致。
- 不包含未定义的占位实现；唯一外部条件是公开发布仓库和 GitHub Secrets，已在 Task 6 明确由仓库所有者配置。
