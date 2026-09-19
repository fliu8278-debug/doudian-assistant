import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join, resolve } from 'node:path';
import { couponsRouter } from './routes/coupons';
import { healthRouter } from './routes/health';
import { newcomerGiftsRouter } from './routes/newcomerGifts';
import { productCouponsRouter } from './routes/productCoupons';
import { searchAfterViewRouter } from './routes/searchAfterView';
import { shopsRouter } from './routes/shops';
import { createVideoFrameExtractionRouter } from './routes/videoFrameExtraction';
import { VideoFrameExtractionManager } from './videoFrameExtraction';

export type StartedServer = {
  server: Server;
  port: number;
  url: string;
};

export function createApp(staticDir = defaultStaticDir()) {
  const app = express();

  app.use(cors({ origin: ['http://127.0.0.1:5173', 'http://localhost:5173'] }));
  app.use(express.json());
  app.use('/api', healthRouter);
  app.use('/api', shopsRouter);
  app.use('/api', couponsRouter);
  app.use('/api', newcomerGiftsRouter);
  app.use('/api', productCouponsRouter);
  app.use('/api', searchAfterViewRouter);
  app.use('/api', createVideoFrameExtractionRouter(new VideoFrameExtractionManager({
    ffmpegPath: process.env.DOUDIAN_FFMPEG_PATH || resolve('vendor', 'ffmpeg', 'win32-x64', 'ffmpeg.exe'),
    ffprobePath: process.env.DOUDIAN_FFPROBE_PATH || resolve('vendor', 'ffmpeg', 'win32-x64', 'ffprobe.exe')
  })));

  if (existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.use((request, response, next) => {
      if (request.method !== 'GET' || request.path.startsWith('/api')) {
        next();
        return;
      }
      response.sendFile(join(staticDir, 'index.html'));
    });
  }

  return app;
}

export function startServer(options: { port?: number; staticDir?: string } = {}) {
  const app = createApp(options.staticDir);
  const server = createServer(app);
  const port = options.port ?? Number(process.env.PORT ?? 4173);

  return new Promise<StartedServer>((resolveStarted, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      resolveStarted({
        server,
        port: actualPort,
        url: `http://127.0.0.1:${actualPort}`
      });
    });
  });
}

function defaultStaticDir() {
  return resolve('dist');
}
