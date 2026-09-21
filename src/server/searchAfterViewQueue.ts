import { randomUUID } from 'node:crypto';
import type { SearchAfterViewResult } from '../rpa/searchAfterView';

export type SearchAfterViewTaskStatus = 'running' | 'paused' | 'complete' | 'failed';

export type SearchAfterViewTask = {
  id: string;
  shopId: string;
  status: SearchAfterViewTaskStatus;
  configured: number;
  errors: number;
  currentSku: string | null;
  message: string;
};

export type SearchAfterViewTaskInput = {
  shopId: string;
  keywords: string[];
  sku?: string;
};

type Entry = {
  controller: AbortController;
  done: Promise<void>;
  task: SearchAfterViewTask;
};

export class SearchAfterViewQueue {
  private entries = new Map<string, Entry>();

  constructor(private readonly runOne: (input: SearchAfterViewTaskInput, signal: AbortSignal) => Promise<SearchAfterViewResult | null>) {}

  start(input: SearchAfterViewTaskInput) {
    const controller = new AbortController();
    const task: SearchAfterViewTask = {
      id: randomUUID(),
      shopId: input.shopId,
      status: 'running',
      configured: 0,
      errors: 0,
      currentSku: null,
      message: '正在配置下一条视频'
    };
    const entry: Entry = { controller, task, done: Promise.resolve() };
    entry.done = this.run(entry, input);
    this.entries.set(task.id, entry);
    return this.copy(task);
  }

  get(taskId: string) {
    const task = this.entries.get(taskId)?.task;
    return task ? this.copy(task) : null;
  }

  pause(taskId: string) {
    const entry = this.entries.get(taskId);
    if (!entry) return null;
    if (entry.task.status === 'running') {
      entry.task.status = 'paused';
      entry.task.message = '任务已暂停，当前条未提交';
      entry.controller.abort();
    }
    return this.copy(entry.task);
  }

  async waitFor(taskId: string) {
    await this.entries.get(taskId)?.done;
    return this.get(taskId);
  }

  private async run(entry: Entry, input: SearchAfterViewTaskInput) {
    try {
      while (!entry.controller.signal.aborted) {
        const result = await this.runOne(input, entry.controller.signal);
        if (entry.controller.signal.aborted) break;
        if (!result) {
          entry.task.status = 'complete';
          entry.task.message = entry.task.configured ? '没有更多待配置视频' : '没有找到可配置视频';
          return;
        }
        entry.task.configured += 1;
        entry.task.currentSku = result.sku;
        entry.task.message = `${result.sku} 已提交，继续配置下一条`;
      }
    } catch (caught) {
      if (!entry.controller.signal.aborted) {
        entry.task.status = 'failed';
        entry.task.errors += 1;
        entry.task.message = caught instanceof Error ? caught.message : '看后搜配置失败';
        return;
      }
    }
    entry.task.status = 'paused';
    entry.task.message = '任务已暂停，当前条未提交';
  }

  private copy(task: SearchAfterViewTask): SearchAfterViewTask {
    return { ...task };
  }
}
