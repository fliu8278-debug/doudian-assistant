import { describe, expect, it } from 'vitest';
import type { VideoFrameExtractionJob } from './api';
import { runVideoFrameBatch, type VideoFrameBatchTask } from './videoFrameBatch';

const settings = { mode: 'random' as const, value: 1 };

function job(id: string, status: VideoFrameExtractionJob['status'], progress: number): VideoFrameExtractionJob {
  return { id, outputName: `${id}.mp4`, progress, settings, status };
}

describe('runVideoFrameBatch', () => {
  it('waits for one video to finish before creating the next one', async () => {
    const calls: string[] = [];
    const updates: VideoFrameBatchTask[][] = [];
    const files = [new File(['a'], 'first.mp4'), new File(['b'], 'second.mp4')];

    await runVideoFrameBatch(files, settings, {
      create: async (file) => {
        calls.push(`create:${file.name}`);
        return job(file.name, 'processing', 1);
      },
      get: async (id) => {
        calls.push(`get:${id}`);
        return job(id, 'complete', 100);
      },
      onUpdate: (tasks) => updates.push(tasks),
      pause: async () => undefined
    });

    expect(calls).toEqual([
      'create:first.mp4',
      'get:first.mp4',
      'create:second.mp4',
      'get:second.mp4'
    ]);
    expect(updates.at(-1)?.map((task) => task.status)).toEqual(['complete', 'complete']);
  });

  it('continues with later videos when a job fails', async () => {
    const created: string[] = [];
    const files = [new File(['a'], 'failed.mp4'), new File(['b'], 'complete.mp4')];

    const tasks = await runVideoFrameBatch(files, settings, {
      create: async (file) => {
        created.push(file.name);
        return job(file.name, 'processing', 1);
      },
      get: async (id) => id === 'failed.mp4'
        ? { ...job(id, 'failed', 100), error: '编码失败' }
        : job(id, 'complete', 100),
      onUpdate: () => undefined,
      pause: async () => undefined
    });

    expect(created).toEqual(['failed.mp4', 'complete.mp4']);
    expect(tasks.map((task) => task.status)).toEqual(['failed', 'complete']);
    expect(tasks[0].error).toBe('编码失败');
  });
});
