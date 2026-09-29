import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ExecutionRecordDialog, ExecutionRecords, friendlyExecutionMessage, paginateExecutionRecords, summarizeExecutionSkus, visibleExecutionFailures } from './ExecutionRecords';

const tasks = [
  { id: '1', sku: '104495', status: 'success', message: '' },
  { id: '2', sku: '117354', status: 'failed', message: '商品搜索无结果' },
  { id: '3', sku: '118415', status: 'success', message: '' }
];
const record = {
  id: 'batch-1', kind: 'newcomerGift' as const, title: '3.xlsx', status: 'partial', totalCount: 3,
  successCount: 1, failedCount: 2, createdAt: '2026-09-29T10:00:00.000Z', updatedAt: '2026-09-29T10:00:00.000Z',
  message: '', tasks
};

it('renders failure details inside a dialog', () => {
  const markup = renderToStaticMarkup(<ExecutionRecordDialog record={record} onClose={() => undefined} />);
  expect(markup).toContain('role="dialog"');
  expect(markup).toContain('失败明细');
  expect(markup).toContain('117354');
  expect(markup).toContain('关闭');
});

it('keeps the execution list compact while retaining SKU and failure details', () => {
  expect(summarizeExecutionSkus(tasks, 2)).toEqual({ visible: ['104495', '117354'], remaining: 1 });
  expect(visibleExecutionFailures(tasks)).toEqual([{ id: '2', sku: '117354', status: 'failed', message: '商品搜索无结果' }]);
});

it('splits execution records into pages of twenty', () => {
  const records = Array.from({ length: 41 }, (_, index) => ({ id: String(index) }));
  expect(paginateExecutionRecords(records, 1)).toHaveLength(20);
  expect(paginateExecutionRecords(records, 2)).toHaveLength(20);
  expect(paginateExecutionRecords(records, 3)).toHaveLength(1);
  expect(paginateExecutionRecords(records, 4)).toHaveLength(0);
});

it('renders the global execution-record workspace shell', () => {
  const markup = renderToStaticMarkup(<ExecutionRecords />);
  expect(markup).toContain('执行记录');
  expect(markup).toContain('所有营销、商品和视频任务的统一历史记录');
  expect(markup).toContain('刷新中…');
});

it('turns internal timeout details into a Chinese reason without exposing screenshot paths', () => {
  expect(friendlyExecutionMessage('locator.click: Timeout 15000ms exceeded，截图：C:\\temp\\failed.png')).toBe('页面控件未在规定时间内出现，任务未完成');
  expect(friendlyExecutionMessage('商品选择失败，截图：C:\\temp\\failed.png')).toBe('商品选择失败');
});
