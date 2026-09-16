import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, join, parse } from 'node:path';

export type VideoFrameExtractionStatus = 'processing' | 'complete' | 'failed';

export type VideoFrameExtractionJob = {
  id: string;
  status: VideoFrameExtractionStatus;
  progress: number;
  targetFps: number;
  outputName: string;
  outputSize?: number;
  duration?: number;
  error?: string;
};

type StoredJob = VideoFrameExtractionJob & {
  outputPath: string;
  directory: string;
};

type ManagerOptions = {
  ffmpegPath: string;
  tempRoot?: string;
};

type StartInput = {
  inputPath: string;
  originalName: string;
  targetFps: number;
};

export class VideoFrameExtractionManager {
  private readonly ffmpegPath: string;
  private readonly jobs = new Map<string, StoredJob>();
  private readonly tempRoot: string;

  constructor(options: ManagerOptions) {
    this.ffmpegPath = options.ffmpegPath;
    this.tempRoot = options.tempRoot ?? join(tmpdir(), 'doudian-video-frame-extraction');
    mkdirSync(this.tempRoot, { recursive: true });
    this.cleanupExpired();
  }

  start(input: StartInput) {
    if (!Number.isInteger(input.targetFps) || input.targetFps < 1 || input.targetFps > 60) {
      throw new Error('目标帧率必须在 1 到 60 FPS 之间');
    }

    const id = randomUUID();
    const directory = join(this.tempRoot, id);
    const inputPath = join(directory, 'input.mp4');
    const outputName = `${safeName(input.originalName)}_${input.targetFps}fps.mp4`;
    const outputPath = join(directory, outputName);
    mkdirSync(directory, { recursive: true });
    renameSync(input.inputPath, inputPath);

    const job: StoredJob = {
      id,
      status: 'processing',
      progress: 1,
      targetFps: input.targetFps,
      outputName,
      outputPath,
      directory
    };
    this.jobs.set(id, job);
    void this.process(job, inputPath);
    return this.toPublicJob(job);
  }

  get(id: string) {
    const job = this.jobs.get(id);
    return job ? this.toPublicJob(job) : undefined;
  }

  downloadPath(id: string) {
    const job = this.jobs.get(id);
    return job?.status === 'complete' && existsSync(job.outputPath) ? job.outputPath : undefined;
  }

  commandFor(inputPath: string, outputPath: string, targetFps: number, audioCodec = 'copy') {
    return [
      '-y', '-i', inputPath,
      '-vf', `fps=${targetFps}`,
      '-map', '0:v:0', '-map', '0:a?',
      '-c:v', 'mpeg4', '-q:v', '3',
      '-c:a', audioCodec,
      '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', outputPath
    ];
  }

  cleanupExpired(maxAgeMs = 24 * 60 * 60 * 1000) {
    if (!existsSync(this.tempRoot)) return;
    const now = Date.now();
    for (const entry of readdirSync(this.tempRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const directory = join(this.tempRoot, entry.name);
      if (now - statSync(directory).mtimeMs <= maxAgeMs) continue;
      removeDirectory(directory);
    }
  }

  private async process(job: StoredJob, inputPath: string) {
    try {
      const result = await this.run(job, inputPath, 'copy');
      if (!result.ok) {
        const retry = await this.run(job, inputPath, 'aac');
        if (!retry.ok) throw new Error(retry.error);
      }
      const output = statSync(job.outputPath);
      job.status = 'complete';
      job.progress = 100;
      job.outputSize = output.size;
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? `处理失败：${error.message}` : '处理失败，请更换视频后重试';
    }
  }

  private run(job: StoredJob, inputPath: string, audioCodec: 'copy' | 'aac') {
    return new Promise<{ ok: boolean; error: string }>((resolve) => {
      const child = spawn(this.ffmpegPath, this.commandFor(inputPath, job.outputPath, job.targetFps, audioCodec), {
        shell: false,
        windowsHide: true
      });
      let stderr = '';
      let duration = 0;

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        for (const line of chunk.split(/\r?\n/)) {
          const match = line.match(/^out_time_(?:ms|us)=(\d+)$/);
          if (!match || !duration) continue;
          const microseconds = Number(match[1]);
          const seconds = line.startsWith('out_time_ms=') ? microseconds / 1_000_000 : microseconds / 1_000_000;
          job.progress = Math.min(99, Math.max(1, Math.round(seconds / duration * 100)));
        }
      });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
        const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (match) {
          duration = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
          job.duration = duration;
        }
      });
      child.once('error', (error) => {
        const code = (error as NodeJS.ErrnoException).code;
        resolve({ ok: false, error: code === 'ENOENT' ? '未找到内置 FFmpeg' : error.message });
      });
      child.once('close', (code) => {
        if (code === 0 && existsSync(job.outputPath)) {
          resolve({ ok: true, error: '' });
          return;
        }
        resolve({ ok: false, error: readableFfmpegError(stderr) });
      });
    });
  }

  private toPublicJob(job: StoredJob): VideoFrameExtractionJob {
    const { outputPath: _outputPath, directory: _directory, ...publicJob } = job;
    return publicJob;
  }
}

function safeName(fileName: string) {
  const stem = parse(basename(fileName)).name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, '_').slice(0, 80);
  return stem || 'video';
}

function readableFfmpegError(stderr: string) {
  if (/Invalid data found|moov atom not found/i.test(stderr)) return '视频文件无法读取，请选择有效的 MP4 文件';
  return '转码未完成，请更换视频后重试';
}

function removeDirectory(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) removeDirectory(target);
    else unlinkSync(target);
  }
  // ponytail: Node 24 has no recovery-bin API; expired app temp files are safe to remove directly.
  rmdirSync(directory);
}
