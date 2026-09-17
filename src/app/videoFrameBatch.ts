import type { VideoFrameExtractionJob } from './api';

export type VideoFrameBatchTask = {
  file: File;
  job?: VideoFrameExtractionJob;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  error?: string;
};

type VideoFrameSettings = { mode: 'random' | 'interval'; value: number };

type VideoFrameBatchOperations = {
  create: (file: File, settings: VideoFrameSettings) => Promise<VideoFrameExtractionJob>;
  get: (jobId: string) => Promise<VideoFrameExtractionJob>;
  onUpdate: (tasks: VideoFrameBatchTask[]) => void;
  pause: () => Promise<void>;
  shouldStop?: () => boolean;
};

export async function runVideoFrameBatch(files: File[], settings: VideoFrameSettings, operations: VideoFrameBatchOperations) {
  const tasks: VideoFrameBatchTask[] = files.map((file) => ({ file, status: 'queued' }));
  const publish = () => operations.onUpdate([...tasks]);

  publish();
  for (const task of tasks) {
    if (operations.shouldStop?.()) break;
    task.status = 'processing';
    publish();

    try {
      let nextJob = await operations.create(task.file, settings);
      task.job = nextJob;
      publish();

      while (nextJob.status === 'processing') {
        await operations.pause();
        if (operations.shouldStop?.()) return tasks;
        nextJob = await operations.get(nextJob.id);
        task.job = nextJob;
        publish();
      }

      if (nextJob.status === 'failed') {
        task.status = 'failed';
        task.error = nextJob.error ?? '视频处理失败，请重试';
      } else {
        task.status = 'complete';
      }
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : '视频处理失败，请重试';
    }
    publish();
  }
  return tasks;
}
