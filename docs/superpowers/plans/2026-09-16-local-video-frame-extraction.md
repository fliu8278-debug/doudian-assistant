# 本地视频抽帧实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让“视频抽帧”在本机用随应用发布的 FFmpeg 生成可预览、可下载的新 MP4。

**Architecture:** Express 新增内存任务管理器和三条视频路由；上传文件写入系统临时目录，任务管理器无 shell 调用 FFmpeg 并解析进度。React 通过现有 `/api` 服务上传和轮询，完成后只使用服务端生成文件的下载地址。Electron 主进程将开发或打包后的 FFmpeg 路径传给服务端。

**Tech Stack:** Electron、Express、Multer、Node.js `child_process`/`fs`、React、Vitest、FFmpeg。

---

## 文件范围

- 新建 `src/server/videoFrameExtraction.ts`：任务状态、输入校验、FFmpeg 命令、进度解析、临时目录清理。
- 新建 `src/server/videoFrameExtraction.test.ts`：验证 FPS、任务状态、成功和失败进度解析。
- 新建 `src/server/routes/videoFrameExtraction.ts`：multipart 上传、状态读取、结果下载。
- 修改 `src/server/app.ts`：注册视频路由并把环境中的 FFmpeg 路径传入。
- 修改 `src/app/api.ts`：创建和查询视频任务的请求函数。
- 修改 `src/app/App.tsx`：移除模拟定时器，改为上传、轮询、结果预览和错误显示。
- 修改 `electron/main.cjs`、`package.json`、`.gitignore`：解析 FFmpeg 路径、在 Windows 包中携带二进制、忽略本地二进制。
- 新建 `scripts/download-ffmpeg.mjs` 与 `docs/third-party/ffmpeg-LICENSE.txt`：准备 LGPL Windows x64 构建并保留许可证文本。

### Task 1: 建立可独立测试的转码任务管理器

**Files:**
- Create: `src/server/videoFrameExtraction.ts`
- Create: `src/server/videoFrameExtraction.test.ts`

- [ ] **Step 1: 写失败测试，限定输入和命令构造。**

```ts
import { describe, expect, it } from 'vitest';
import { VideoFrameExtractionManager } from './videoFrameExtraction';

describe('video frame extraction', () => {
  it('rejects target fps outside 1–60', () => {
    const manager = new VideoFrameExtractionManager({ ffmpegPath: 'ffmpeg.exe' });
    expect(() => manager.start({ inputPath: 'input.mp4', originalName: 'input.mp4', targetFps: 0 })).toThrow('目标帧率必须在 1 到 60 FPS 之间');
  });
  it('creates an H.264 MP4 command that keeps an optional audio stream', () => {
    const manager = new VideoFrameExtractionManager({ ffmpegPath: 'ffmpeg.exe' });
    expect(manager.commandFor('input.mp4', 'output.mp4', 15)).toEqual(expect.arrayContaining(['-vf', 'fps=15', '-map', '0:v:0', '-map', '0:a?', '-c:v', 'mpeg4', '-q:v', '3', '-c:a', 'copy']));
  });
});
```

- [ ] **Step 2: 运行测试，确认因模块不存在而失败。**

Run: `npm test -- src/server/videoFrameExtraction.test.ts`

Expected: FAIL，提示无法解析 `./videoFrameExtraction`。

- [ ] **Step 3: 最小实现任务管理器。**

实现 `VideoFrameExtractionManager`，只暴露 `start`、`get`、`commandFor`、`downloadPath`、`cleanupExpired`。`start` 验证 1–60 FPS、生成 `randomUUID()` 任务目录、以参数数组执行：

```ts
['-y', '-i', inputPath, '-vf', `fps=${targetFps}`, '-map', '0:v:0', '-map', '0:a?', '-c:v', 'mpeg4', '-q:v', '3', '-c:a', 'copy', '-movflags', '+faststart', '-progress', 'pipe:1', outputPath]
```

解析 `out_time_ms` 和 `progress=end` 为 0–100；若音频直拷贝导致 FFmpeg 失败，则只重试一次并将 `-c:a copy` 改为 `-c:a aac`。仍失败时把任务变为 `failed` 并保存非敏感中文错误。任务目录在进程启动时删除 24 小时以前的目录。

- [ ] **Step 4: 运行测试，确认通过。**

Run: `npm test -- src/server/videoFrameExtraction.test.ts`

Expected: PASS，2 tests passed。

- [ ] **Step 5: 提交此独立逻辑。**

```powershell
git add src/server/videoFrameExtraction.ts src/server/videoFrameExtraction.test.ts
git commit -m "feat: add video frame extraction manager"
```

### Task 2: 接入安全的本地 HTTP 上传、状态和下载路由

**Files:**
- Create: `src/server/routes/videoFrameExtraction.ts`
- Modify: `src/server/app.ts`
- Test: `src/server/videoFrameExtraction.test.ts`

- [ ] **Step 1: 扩展失败测试，验证不存在任务和未完成任务不能下载。**

```ts
it('does not expose a result path before a job completes', () => {
  const manager = new VideoFrameExtractionManager({ ffmpegPath: 'ffmpeg.exe' });
  expect(manager.downloadPath('unknown')).toBeUndefined();
});
```

- [ ] **Step 2: 运行测试，确认失败。**

Run: `npm test -- src/server/videoFrameExtraction.test.ts`

Expected: FAIL，`downloadPath` 不存在或行为不符合预期。

- [ ] **Step 3: 实现路由并注册。**

`videoFrameExtraction.ts` 路由使用 `multer.diskStorage` 写入系统 temp 的 `doudian-video-frame-extraction/uploads`，仅接受字段 `video`、MP4 MIME/扩展名和最大 2 GB。`POST /video-frame-extraction` 以 202 返回任务；`GET /video-frame-extraction/:id` 返回公开状态；`GET /video-frame-extraction/:id/download` 只有完成时使用 `response.download()`。错误只返回 JSON `{ error }`，绝不返回真实路径。

在 `createApp` 中创建一个 manager，`process.env.DOUDIAN_FFMPEG_PATH` 优先，否则使用 `vendor/ffmpeg/win32-x64/ffmpeg.exe`，并注册 `app.use('/api', videoFrameExtractionRouter)`。

- [ ] **Step 4: 运行服务端相关测试。**

Run: `npm test -- src/server/videoFrameExtraction.test.ts src/server/couponQueue.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交路由。**

```powershell
git add src/server/routes/videoFrameExtraction.ts src/server/app.ts src/server/videoFrameExtraction.ts src/server/videoFrameExtraction.test.ts
git commit -m "feat: expose local video conversion API"
```

### Task 3: 将已有页面改为真实上传、轮询和下载

**Files:**
- Modify: `src/app/api.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

- [ ] **Step 1: 写前端渲染失败测试。**

在 `App.test.tsx` 断言初始输出区没有原视频 blob 下载地址，并保留“下载视频”禁用状态：

```ts
expect(markup).toContain('下载视频');
expect(markup).not.toContain('blob:');
```

- [ ] **Step 2: 运行测试确认旧模拟逻辑不满足新断言。**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL，旧组件仍以 `sourceUrl` 作为完成后的下载源。

- [ ] **Step 3: 新增 API 客户端并替换模拟状态。**

`api.ts` 增加 `createVideoFrameExtraction(file, targetFps)` 和 `getVideoFrameExtraction(id)`；前者用 `FormData` 传 `video` 与 `targetFps`，两者沿用现有 `readJson` 错误处理。

`VideoFrameRateWorkbench` 删除 `timersRef`。新增任务 ID、服务端状态、错误文本与结果 URL；点击开始时上传，随后每秒轮询，直到 `complete` 或 `failed`。完成后使用返回的下载 URL 作为右侧 `<video src>` 和 `<a href>`，显示服务端返回的产物大小和时长；更换视频时取消轮询、清除旧结果且继续保留左侧原视频预览。

- [ ] **Step 4: 运行前端测试。**

Run: `npm test -- src/app/App.test.tsx`

Expected: PASS。

- [ ] **Step 5: 提交用户界面接线。**

```powershell
git add src/app/api.ts src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: process video frame rate from workspace"
```

### Task 4: 让 Windows 安装包自带 FFmpeg 并验证构建

**Files:**
- Create: `scripts/download-ffmpeg.mjs`
- Create: `docs/third-party/ffmpeg-LICENSE.txt`
- Modify: `electron/main.cjs`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: 写下载脚本的失败检查。**

脚本当 `vendor/ffmpeg/win32-x64/ffmpeg.exe` 缺失时，下载固定的 Windows x64 LGPL 发行包；当文件存在则成功退出。脚本下载后只解压 `ffmpeg.exe` 和发行包中的许可证文件。

- [ ] **Step 2: 运行脚本，确认本机获得可执行文件。**

Run: `node scripts/download-ffmpeg.mjs`

Expected: 输出 `FFmpeg 已准备：vendor/ffmpeg/win32-x64/ffmpeg.exe`。

- [ ] **Step 3: 配置 Electron 运行与打包路径。**

在 `main.cjs` 的 `startApp` 前设置：

```js
process.env.DOUDIAN_FFMPEG_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'ffmpeg', 'win32-x64', 'ffmpeg.exe')
  : path.join(process.cwd(), 'vendor', 'ffmpeg', 'win32-x64', 'ffmpeg.exe');
```

在 `package.json` 增加 `prepare:ffmpeg`，并将 `vendor/ffmpeg/win32-x64` 配为 `build.extraResources` 的资源目标 `ffmpeg/win32-x64`。将 `vendor/ffmpeg/` 加入 `.gitignore`，提交许可证文本而非二进制。

- [ ] **Step 4: 验证 FFmpeg、测试与编译。**

Run: `& .\vendor\ffmpeg\win32-x64\ffmpeg.exe -version; npm test; npm run build; git diff --check`

Expected: FFmpeg 输出版本信息；所有测试、typecheck、Vite 和服务端构建通过；diff 检查无输出。

- [ ] **Step 5: 提交发布配置。**

```powershell
git add scripts/download-ffmpeg.mjs docs/third-party/ffmpeg-LICENSE.txt electron/main.cjs package.json .gitignore
git commit -m "build: bundle ffmpeg for video conversion"
```

## 计划自检

- 设计中的三条 API、临时目录、输入校验、安全调用、进度、音频回退、前端预览下载和 Windows 资源打包分别由 Task 1–4 覆盖。
- 计划不引入新 npm 包；复用已有 Multer、Express、Vitest 和原生 Node API。
- 任务名、API 路径、状态和下载方式在所有任务中保持一致。
