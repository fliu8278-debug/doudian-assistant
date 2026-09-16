import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, join, parse } from 'node:path';

export type VideoFrameExtractionStatus = 'processing' | 'complete' | 'failed';
export type FrameDropMode = 'random' | 'interval';
export type FrameDropSettings = { mode: FrameDropMode; value: number };

export type VideoFrameExtractionJob = {
  id: string;
  status: VideoFrameExtractionStatus;
  progress: number;
  settings: FrameDropSettings;
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
  ffprobePath?: string;
  tempRoot?: string;
};

type StartInput = {
  inputPath: string;
  originalName: string;
  settings: FrameDropSettings;
};

export class VideoFrameExtractionManager {
  private readonly ffmpegPath: string;
  private readonly ffprobePath: string;
  private readonly jobs = new Map<string, StoredJob>();
  private readonly tempRoot: string;

  constructor(options: ManagerOptions) {
    this.ffmpegPath = options.ffmpegPath;
    this.ffprobePath = options.ffprobePath ?? options.ffmpegPath.replace(/ffmpeg\.exe$/i, 'ffprobe.exe');
    this.tempRoot = options.tempRoot ?? join(tmpdir(), 'doudian-video-frame-extraction');
    mkdirSync(this.tempRoot, { recursive: true });
    this.cleanupExpired();
  }

  start(input: StartInput) {
    this.validateSettings(input.settings);

    const id = randomUUID();
    const directory = join(this.tempRoot, id);
    const inputPath = join(directory, 'input.mp4');
    const suffix = input.settings.mode === 'random' ? `random_${input.settings.value}frames` : `every_${input.settings.value}s`;
    const outputName = `${safeName(input.originalName)}_${suffix}.mp4`;
    const outputPath = join(directory, outputName);
    mkdirSync(directory, { recursive: true });
    renameSync(input.inputPath, inputPath);

    const job: StoredJob = {
      id,
      status: 'processing',
      progress: 1,
      settings: input.settings,
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

  validateSettings(settings: FrameDropSettings) {
    if (!settings || !['random', 'interval'].includes(settings.mode) || !Number.isInteger(settings.value)) {
      throw new Error('抽帧参数无效');
    }
    if (settings.mode === 'random' && (settings.value < 1 || settings.value > 100)) {
      throw new Error('随机删除帧数必须在 1 到 100 之间');
    }
    if (settings.mode === 'interval' && (settings.value < 1 || settings.value > 60)) {
      throw new Error('间隔秒数必须在 1 到 60 之间');
    }
  }

  commandFor(inputPath: string, outputPath: string, settings: FrameDropSettings, source: VideoSource) {
    const droppedFrames = this.framesToDrop(settings, source);
    return [
      '-y', '-i', inputPath,
      '-vf', `select=not(${droppedFrames.map((frame) => `eq(n\\,${frame})`).join('+')})`, '-fps_mode', 'passthrough',
      '-map', '0:v:0', '-map', '0:a?',
      '-c:v', 'h264_mf', '-b:v', '5M',
      '-c:a', 'aac',
      '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', outputPath
    ];
  }

  private framesToDrop(settings: FrameDropSettings, source: VideoSource) {
    const available = Math.max(0, source.frameCount - 2);
    if (!available) throw new Error('视频帧数不足，无法抽帧');
    if (settings.mode === 'interval') {
      const intervalFrames = Math.max(1, Math.round(source.frameRate * settings.value));
      const frames: number[] = [];
      for (let frame = intervalFrames; frame < source.frameCount - 1; frame += intervalFrames) frames.push(frame);
      if (!frames.length) throw new Error('视频时长小于设置的抽帧间隔');
      return frames;
    }
    if (settings.value > available) throw new Error(`随机删除帧数不能超过 ${available} 帧`);
    const frames = new Set<number>();
    while (frames.size < settings.value) frames.add(1 + Math.floor(Math.random() * available));
    return [...frames].sort((first, second) => first - second);
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
      const source = await this.probe(inputPath);
      const result = await this.run(job, inputPath, source);
      if (!result.ok) throw new Error(result.error);
      const output = statSync(job.outputPath);
      job.status = 'complete';
      job.progress = 100;
      job.outputSize = output.size;
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? `处理失败：${error.message}` : '处理失败，请更换视频后重试';
    }
  }

  private probe(inputPath: string) {
    return new Promise<VideoSource>((resolve, reject) => {
      const child = spawn(this.ffprobePath, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate,nb_frames,duration', '-of', 'json', inputPath], { shell: false, windowsHide: true });
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { stdout += chunk; });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => { stderr += chunk; });
      child.once('error', (error) => reject(new Error((error as NodeJS.ErrnoException).code === 'ENOENT' ? '未找到内置 FFprobe' : error.message)));
      child.once('close', (code) => {
        if (code !== 0) return reject(new Error(stderr || '无法读取视频信息'));
        try {
          const stream = JSON.parse(stdout).streams?.[0] as { avg_frame_rate?: string; nb_frames?: string; duration?: string } | undefined;
          const [numerator, denominator] = (stream?.avg_frame_rate ?? '').split('/').map(Number);
          const frameRate = denominator ? numerator / denominator : numerator;
          const duration = Number(stream?.duration);
          const frameCount = Number(stream?.nb_frames) || Math.floor(frameRate * duration);
          if (!Number.isFinite(frameRate) || frameRate <= 0 || !Number.isFinite(frameCount) || frameCount < 3) throw new Error('视频帧数不足，无法抽帧');
          resolve({ frameRate, frameCount });
        } catch (error) {
          reject(error instanceof Error ? error : new Error('无法读取视频信息'));
        }
      });
    });
  }

  private run(job: StoredJob, inputPath: string, source: VideoSource) {
    return new Promise<{ ok: boolean; error: string }>((resolve) => {
      const child = spawn(this.ffmpegPath, this.commandFor(inputPath, job.outputPath, job.settings, source), {
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

type VideoSource = { frameRate: number; frameCount: number };

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
