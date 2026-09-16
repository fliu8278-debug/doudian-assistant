import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { VideoFrameExtractionManager } from '../videoFrameExtraction';

const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024;

export function createVideoFrameExtractionRouter(manager: VideoFrameExtractionManager) {
  const router = Router();
  const uploadRoot = join(tmpdir(), 'doudian-video-frame-extraction', 'uploads');
  mkdirSync(uploadRoot, { recursive: true });
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadRoot,
      filename: (_request, file, callback) => callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`)
    }),
    limits: { fileSize: MAX_VIDEO_SIZE },
    fileFilter: (_request, file, callback) => {
      const isMp4 = extname(file.originalname).toLowerCase() === '.mp4'
        && ['video/mp4', 'application/octet-stream'].includes(file.mimetype);
      if (!isMp4) {
        callback(new Error('仅支持 MP4 视频文件'));
        return;
      }
      callback(null, true);
    }
  });

  router.post('/video-frame-extraction', (request, response, next) => {
    upload.single('video')(request, response, (error) => {
      if (!error) return next();
      const message = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
        ? '视频文件不能超过 2 GB'
        : error instanceof Error ? error.message : '视频上传失败';
      response.status(400).json({ error: message });
    });
  }, (request, response) => {
    const file = request.file;
    if (!file) {
      response.status(400).json({ error: '请选择 MP4 视频文件' });
      return;
    }

    try {
      const job = manager.start({
        inputPath: file.path,
        originalName: file.originalname,
        targetFps: Number(request.body?.targetFps)
      });
      response.status(202).json(jobResponse(request, job));
    } catch (error) {
      if (existsSync(file.path)) unlinkSync(file.path);
      response.status(400).json({ error: error instanceof Error ? error.message : '无法创建视频处理任务' });
    }
  });

  router.get('/video-frame-extraction/:id', (request, response) => {
    const job = manager.get(request.params.id);
    if (!job) {
      response.status(404).json({ error: '视频处理任务不存在' });
      return;
    }
    response.json(jobResponse(request, job));
  });

  router.get('/video-frame-extraction/:id/download', (request, response) => {
    const job = manager.get(request.params.id);
    const outputPath = manager.downloadPath(request.params.id);
    if (!job || !outputPath) {
      response.status(404).json({ error: '视频尚未处理完成' });
      return;
    }
    response.download(outputPath, job.outputName);
  });

  return router;
}

function jobResponse(request: { baseUrl: string }, job: ReturnType<VideoFrameExtractionManager['get']> extends infer Result ? Exclude<Result, undefined> : never) {
  return {
    ...job,
    downloadUrl: job.status === 'complete' ? `${request.baseUrl}/video-frame-extraction/${job.id}/download` : undefined
  };
}
