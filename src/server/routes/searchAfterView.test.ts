import { createServer } from 'node:http';
import express from 'express';
import { describe, expect, it } from 'vitest';
import { SearchAfterViewQueue } from '../searchAfterViewQueue';
import { createSearchAfterViewRouter } from './searchAfterView';

describe('看后搜任务接口', () => {
  it('启动任务后可立即暂停并查询暂停状态', async () => {
    const queue = new SearchAfterViewQueue(async (_input, signal) => {
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
      return null;
    });
    const app = express();
    app.use(express.json());
    app.use('/api', createSearchAfterViewRouter(queue));
    const server = createServer(app);

    try {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      const url = `http://127.0.0.1:${port}/api/search-after-view`;

      const started = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: 'shop-1', keywords: ['斯凯奇男鞋'] })
      });
      const task = await started.json() as { id: string; status: string };

      expect(started.status).toBe(202);
      expect(task.status).toBe('running');

      const paused = await fetch(`${url}/${task.id}/pause`, { method: 'POST' });
      expect(paused.status).toBe(200);
      await expect(paused.json()).resolves.toMatchObject({ id: task.id, status: 'paused' });

      const status = await fetch(`${url}/${task.id}`);
      await expect(status.json()).resolves.toMatchObject({ id: task.id, status: 'paused', configured: 0 });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
