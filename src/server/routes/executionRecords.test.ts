import { afterEach, expect, it } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../../db/database';
import { saveExecutionRun } from '../../db/executionRecords';
import { createExecutionRecordsRouter } from './executionRecords';

const directory = mkdtempSync(join(tmpdir(), 'execution-route-'));
const database = openDatabase(join(directory, 'app.sqlite'));
let server: ReturnType<typeof createServer> | undefined;

afterEach(async () => {
  database.exec('delete from execution_runs');
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

it('returns persisted records through the unified endpoint', async () => {
  saveExecutionRun(database, { id: 'run-1', kind: 'searchAfterView', title: '看后搜', status: 'failed', totalCount: 1, successCount: 0, failedCount: 1, message: '商品选择失败' });
  const app = express();
  app.use('/api', createExecutionRecordsRouter(database));
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const response = await fetch(`http://127.0.0.1:${port}/api/execution-records`);
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'searchAfterView', status: 'failed' })]));
});
