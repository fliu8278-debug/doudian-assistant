import { describe, expect, it } from 'vitest';
import { startServer } from './app';
import { VideoFrameExtractionManager } from './videoFrameExtraction';

describe('video frame extraction', () => {
  it('rejects a target frame rate outside 1 to 60 FPS', () => {
    const manager = new VideoFrameExtractionManager({ ffmpegPath: 'ffmpeg.exe' });

    expect(() => manager.start({
      inputPath: 'input.mp4',
      originalName: 'input.mp4',
      targetFps: 0
    })).toThrow('目标帧率必须在 1 到 60 FPS 之间');
  });

  it('creates an MP4 command with the built-in MPEG-4 encoder and optional audio', () => {
    const manager = new VideoFrameExtractionManager({ ffmpegPath: 'ffmpeg.exe' });

    expect(manager.commandFor('input.mp4', 'output.mp4', 15)).toEqual(expect.arrayContaining([
      '-vf', 'fps=15', '-map', '0:v:0', '-map', '0:a?', '-c:v', 'mpeg4', '-q:v', '3', '-c:a', 'copy'
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
      form.append('targetFps', '15');

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
});
