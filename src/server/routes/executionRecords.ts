import { Router } from 'express';
import type { AppDatabase } from '../../db/database';
import { listExecutionRecords } from '../../db/executionRecords';
import { db as defaultDb } from '../db';

export function createExecutionRecordsRouter(database: AppDatabase = defaultDb) {
  const router = Router();
  router.get('/execution-records', (_request, response) => {
    response.json(listExecutionRecords(database));
  });
  return router;
}

export const executionRecordsRouter = createExecutionRecordsRouter();
