import { describe, expect, it } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from './app';
import { createVideoFrameExtractionRouter } from './routes/videoFrameExtraction';
import { VideoFrameExtractionManager } from './videoFrameExtraction';

describe('video frame extraction', () => {
  it('validates both sparse frame-drop modes', () => {
    const manager = new VideoFrameExtractionManager({ ffmpegPath: 'ffmpeg.exe' });

    expect(() => manager.validateSettings({ mode: 'random', value: 0 })).toThrow('随机删除帧数必须在 1 到 100 之间');
    expect(() => manager.validateSettings({ mode: 'interval', value: 0 })).toThrow('间隔秒数必须在 1 到 60 之间');
  });

  it('creates a sparse frame-drop command without lowering the whole video frame rate', () => {
    const manager = new VideoFrameExtractionManager({ ffmpegPath: 'ffmpeg.exe' });

    expect(manager.commandFor('input.mp4', 'output.mp4', { mode: 'random', value: 2 }, { frameRate: 30, frameCount: 300 })).toEqual(expect.arrayContaining([
      '-vf', expect.stringContaining('select=not('), '-fps_mode', 'passthrough', '-map', '0:v:0', '-map', '0:a?', '-c:v', 'h264_mf', '-c:a', 'aac'
    ]));
  });

  it('does not expose a result path before a job completes', () => {
    const manager = new VideoFrameExtractionManager({ ffmpegPath: 'ffmpeg.exe' });

    expect(manager.downloadPath('unknown')).toBeUndefined();
  });

  it('rejects a non-MP4 upload before creating a conversion job', async () => {
    const started = await startServer({ port: 0, staticDir: 'missing-static-dir' });
    try {
      const form = new FormData();
      form.append('video', new Blob(['not a video'], { type: 'text/plain' }), 'note.txt');
      form.append('mode', 'random');
      form.append('value', '1');

      const response = await fetch(`${started.url}/api/video-frame-extraction`, {
        method: 'POST',
        body: form
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: '仅支持 MP4 视频文件' });
    } finally {
      await new Promise<void>((resolve, reject) => started.server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it('serves a completed output as an inline MP4 preview', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'doudian-preview-test-'));
    const outputPath = join(directory, 'clip_15fps.mp4');
    writeFileSync(outputPath, 'test mp4 content');
    const manager = {
      get: () => ({
        id: 'job-1', status: 'complete' as const, progress: 100, settings: { mode: 'random' as const, value: 1 }, outputName: 'clip_random_1frames.mp4'
      }),
      downloadPath: () => outputPath
    } as unknown as VideoFrameExtractionManager;
    const app = express();
    app.use('/api', createVideoFrameExtractionRouter(manager));
    const server = createServer(app);

    try {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      const response = await fetch(`http://127.0.0.1:${port}/api/video-frame-extraction/job-1/preview`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('video/mp4');
      expect(response.headers.get('content-disposition')).toMatch(/^inline/);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
