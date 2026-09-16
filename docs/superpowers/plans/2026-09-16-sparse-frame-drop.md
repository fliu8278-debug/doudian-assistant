# Sparse Frame Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed-FPS video conversion with random and interval-based sparse frame deletion while retaining audio and the original timeline.

**Architecture:** The browser sends a mode and numeric value with the MP4 upload. The server probes source frame rate, builds an FFmpeg `select` filter that excludes only selected frame numbers, and encodes an H.264/AAC MP4 without resetting video timestamps. The React workbench displays the selected mode rather than an output FPS.

**Tech Stack:** React 19, Express, TypeScript, bundled FFmpeg/FFprobe, Vitest.

---

### Task 1: Define and validate sparse-frame processing

**Files:**
- Modify: `src/server/videoFrameExtraction.ts`
- Test: `src/server/videoFrameExtraction.test.ts`

- [ ] **Step 1: Write failing server tests**

```ts
expect(manager.commandFor('input.mp4', 'output.mp4', { mode: 'random', value: 2 }, { frameRate: 30, frameCount: 300 }))
  .toEqual(expect.arrayContaining(['-vf', expect.stringContaining('select=not('), '-fps_mode', 'passthrough']));
expect(() => manager.validateSettings({ mode: 'interval', value: 0 })).toThrow('间隔秒数必须在 1 到 60 之间');
```

- [ ] **Step 2: Run test and confirm it fails**

Run: `npm test -- src/server/videoFrameExtraction.test.ts`

Expected: FAIL because the manager accepts only `targetFps`.

- [ ] **Step 3: Replace `targetFps` with sparse settings and add source probing**

```ts
export type FrameDropSettings = { mode: 'random' | 'interval'; value: number };

private frameFilter(settings: FrameDropSettings, source: { frameRate: number; frameCount: number }) {
  const frames = settings.mode === 'interval'
    ? intervalFrames(Math.round(source.frameRate * settings.value), source.frameCount)
    : randomFrames(settings.value, source.frameCount);
  return `select=not(${frames.map((frame) => `eq(n\\,${frame})`).join('+')})`;
}
```

Use `ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate,nb_frames,duration -of json` with the existing child-process API. Fall back to `Math.floor(duration * frameRate)` only when `nb_frames` is unavailable. Reject a source shorter than three frames and values outside `1..100` for random mode or `1..60` for interval mode.

- [ ] **Step 4: Build FFmpeg command without fixed FPS conversion**

```ts
'-vf', this.frameFilter(settings, source),
'-fps_mode', 'passthrough',
'-map', '0:v:0', '-map', '0:a?',
'-c:v', 'h264_mf', '-b:v', '5M', '-c:a', 'aac'
```

Do not use `fps=<targetFps>` or `setpts`; retaining timestamps preserves audio alignment and video duration.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/server/videoFrameExtraction.test.ts`

Expected: all server video tests pass.

### Task 2: Send sparse settings through the upload API

**Files:**
- Modify: `src/server/routes/videoFrameExtraction.ts`
- Modify: `src/server/app.ts`
- Modify: `electron/main.cjs`
- Modify: `src/app/api.ts`
- Test: `src/app/api.test.ts`

- [ ] **Step 1: Write a failing browser API test**

```ts
await createVideoFrameExtraction(file, { mode: 'interval', value: 3 });
expect((request.body as FormData).get('mode')).toBe('interval');
expect((request.body as FormData).get('value')).toBe('3');
```

- [ ] **Step 2: Run it and confirm failure**

Run: `npm test -- src/app/api.test.ts`

Expected: FAIL because the client currently submits `targetFps`.

- [ ] **Step 3: Implement the API contract**

```ts
export async function createVideoFrameExtraction(file: File, settings: FrameDropSettings) {
  const form = new FormData();
  form.append('video', file);
  form.append('mode', settings.mode);
  form.append('value', String(settings.value));
  return readJson<VideoFrameExtractionJob>(await fetch('/api/video-frame-extraction', { method: 'POST', body: form }));
}
```

Route `mode` and `value` into the manager; configure `ffprobePath` in `app.ts` and set `DOUDIAN_FFPROBE_PATH` beside the already configured FFmpeg executable in `electron/main.cjs`.

- [ ] **Step 4: Run focused API tests**

Run: `npm test -- src/app/api.test.ts src/server/videoFrameExtraction.test.ts`

Expected: all focused tests pass.

### Task 3: Replace the FPS controls with two sparse-frame modes

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/styles.css`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: Add a failing UI test**

```tsx
expect(markup).toContain('随机抽帧');
expect(markup).toContain('间隔抽帧');
expect(markup).not.toContain('目标帧率');
```

- [ ] **Step 2: Run it and confirm failure**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because the workbench renders the target-FPS control.

- [ ] **Step 3: Render the approved controls**

Use `mode` state defaulting to `random`, one numeric `value` state defaulting to `1`, buttons for the two modes, and mode-specific text:

```tsx
const settingLabel = frameDropMode === 'random' ? `随机删除 ${frameDropValue} 帧` : `每隔 ${frameDropValue} 秒删除 1 帧`;
```

Pass `{ mode: frameDropMode, value: frameDropValue }` to the upload API. Replace the page description with “随机或按间隔删除稀疏画面帧，保留原声与原视频时间线。” Replace output FPS with “处理方式” and `settingLabel`.

- [ ] **Step 4: Style the existing settings area**

Add styles only for the two mode buttons and active state, using existing blue `#1769e0`, existing card borders, and native buttons. Do not add dependencies or new layout containers.

- [ ] **Step 5: Run focused UI tests**

Run: `npm test -- src/app/App.test.tsx src/app/api.test.ts`

Expected: all focused tests pass.

### Task 4: Verify output and publish the combined 0.1.6 update

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Update release note**

Add a 0.1.6 bullet: “视频抽帧改为随机或按间隔删除稀疏画面帧，不再固定降低视频帧率。”

- [ ] **Step 2: Generate a local fixture and process it**

Run bundled FFmpeg with `testsrc2` and sine audio to make a short MP4, then run the manager against random mode. Inspect with bundled FFprobe and require H.264 video, AAC audio, and duration within 0.1 seconds of the source.

- [ ] **Step 3: Run final verification and create installer**

Run: `npm test && npm run typecheck && npm run dist:win && git diff --check`

Expected: all tests pass, TypeScript exits 0, `release/抖店助手 Setup 0.1.6.exe` exists, and Git has no whitespace errors.

- [ ] **Step 4: Commit and publish**

```bash
git add src electron CHANGELOG.md package.json package-lock.json
git commit -m "feat: drop sparse video frames"
git push origin main
git tag v0.1.6
git push origin v0.1.6
```
