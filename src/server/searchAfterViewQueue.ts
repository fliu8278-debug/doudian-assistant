import { randomUUID } from 'node:crypto';
import { SearchAfterViewRowError, type SearchAfterViewResult } from '../rpa/searchAfterView';

export type SearchAfterViewTaskStatus = 'running' | 'paused' | 'complete' | 'failed';

export type SearchAfterViewTask = {
  id: string;
  shopId: string;
  status: SearchAfterViewTaskStatus;
  configured: number;
  errors: number;
  currentVideoId: string | null;
  currentSku: string | null;
  message: string;
};

export type SearchAfterViewTargetProgress = {
  videoId: string;
  sku: string;
};

export type SearchAfterViewTaskInput = {
  shopId: string;
  keywords: string[];
  sku?: string;
  skippedVideoIds?: string[];
};

type Entry = {
  controller: AbortController;
  done: Promise<void>;
  task: SearchAfterViewTask;
};

type RunOne = (
  input: SearchAfterViewTaskInput,
  signal: AbortSignal,
  onTarget?: (target: SearchAfterViewTargetProgress) => void
) => Promise<SearchAfterViewResult | null>;

export class SearchAfterViewQueue {
  private activeTaskByShop = new Map<string, string>();
  private entries = new Map<string, Entry>();

  constructor(private readonly runOne: RunOne) {}

  start(input: SearchAfterViewTaskInput) {
    const activeTaskId = this.activeTaskByShop.get(input.shopId);
    const activeTask = activeTaskId ? this.entries.get(activeTaskId)?.task : undefined;
    if (activeTask?.status === 'running') return this.copy(activeTask);

    const controller = new AbortController();
    const task: SearchAfterViewTask = {
      id: randomUUID(),
      shopId: input.shopId,
      status: 'running',
      configured: 0,
      errors: 0,
      currentVideoId: null,
      currentSku: null,
      message: '正在配置下一条视频'
    };
    const entry: Entry = { controller, task, done: Promise.resolve() };
    this.entries.set(task.id, entry);
    this.activeTaskByShop.set(task.shopId, task.id);
    entry.done = this.run(entry, input);
    return this.copy(task);
  }

  get(taskId: string) {
    const task = this.entries.get(taskId)?.task;
    return task ? this.copy(task) : null;
  }

  async pause(taskId: string) {
    const entry = this.entries.get(taskId);
    if (!entry) return null;
    if (entry.task.status === 'running') {
      entry.controller.abort();
      await entry.done;
    }
    return this.copy(entry.task);
  }

  async waitFor(taskId: string) {
    await this.entries.get(taskId)?.done;
    return this.get(taskId);
  }

  private async run(entry: Entry, input: SearchAfterViewTaskInput) {
    const skippedVideoIds = [...(input.skippedVideoIds ?? [])];
    try {
      while (!entry.controller.signal.aborted) {
        let result: SearchAfterViewResult | null;
        try {
          result = await this.runOne(
            { ...input, skippedVideoIds: [...skippedVideoIds] },
            entry.controller.signal,
            (target) => {
              entry.task.currentVideoId = target.videoId;
              entry.task.currentSku = target.sku;
              entry.task.message = `正在配置视频 ${target.videoId}（款号 ${target.sku}）`;
            }
          );
        } catch (caught) {
          if (entry.controller.signal.aborted) break;
          if (caught instanceof SearchAfterViewRowError) {
            entry.task.errors += 1;
            if (!skippedVideoIds.includes(caught.videoId)) skippedVideoIds.push(caught.videoId);
            entry.task.message = `视频 ${caught.videoId} 配置失败：${caught.message}；已跳过并继续下一条`;
            continue;
          }
          throw caught;
        }
        if (entry.controller.signal.aborted) break;
        if (!result) {
          entry.task.status = 'complete';
          entry.task.message = entry.task.configured ? '没有更多待配置视频' : '没有找到可配置视频';
          return;
        }
        if (!skippedVideoIds.includes(result.videoId)) skippedVideoIds.push(result.videoId);
        entry.task.configured += 1;
        entry.task.currentSku = result.sku;
        entry.task.message = `${result.sku} 已提交，继续配置下一条`;
      }
      entry.task.status = 'paused';
      entry.task.message = '任务已暂停，当前条未提交';
    } catch (caught) {
      if (!entry.controller.signal.aborted) {
        entry.task.status = 'failed';
        entry.task.errors += 1;
        entry.task.message = caught instanceof Error ? caught.message : '看后搜配置失败';
        return;
      }
      entry.task.status = 'paused';
      entry.task.message = '任务已暂停，当前条未提交';
    } finally {
      if (this.activeTaskByShop.get(entry.task.shopId) === entry.task.id) this.activeTaskByShop.delete(entry.task.shopId);
    }
  }

  private copy(task: SearchAfterViewTask): SearchAfterViewTask {
    return { ...task };
  }
}
