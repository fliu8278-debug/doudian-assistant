import { useCallback, useEffect, useMemo, useState } from 'react';
import { getExecutionRecords, type ExecutionRecord } from '../../api';

const labels: Record<ExecutionRecord['kind'], string> = {
  fan: '涨粉券', product: '商品优惠券', national: '国补优惠券', legacy: '历史优惠券（类别未记录）',
  newcomerGift: '新人礼金', searchAfterView: '看后搜', videoFrameExtraction: '视频抽帧'
};
const statusLabels: Record<string, string> = {
  pending: '等待中', running: '执行中', success: '已完成', complete: '已完成', failed: '失败', partial: '部分完成',
  waiting_confirm: '待确认', skipped: '已跳过', paused: '已暂停', interrupted: '已中断'
};
export const EXECUTION_RECORDS_PAGE_SIZE = 20;

export function paginateExecutionRecords<T>(records: T[], page: number, pageSize = EXECUTION_RECORDS_PAGE_SIZE) {
  const start = Math.max(0, page - 1) * pageSize;
  return records.slice(start, start + pageSize);
}

type ExecutionTask = ExecutionRecord['tasks'][number];

export function summarizeExecutionSkus(tasks: ExecutionTask[], limit = 8) {
  const skus = [...new Set(tasks.map((task) => String(task.sku ?? '').trim()).filter(Boolean))];
  return { visible: skus.slice(0, limit), remaining: Math.max(0, skus.length - limit) };
}

export function visibleExecutionFailures(tasks: ExecutionTask[]) {
  return tasks.filter((task) => task.status === 'failed');
}

export function friendlyExecutionMessage(message: string) {
  if (!message) return '';
  if (/locator\.|timeout \d+ms exceeded|waiting for getby/i.test(message)) return '页面控件未在规定时间内出现，任务未完成';
  return message.replace(/[,，]?\s*截图\s*[:：].*$/i, '').trim();
}

export function ExecutionRecords() {
  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<ExecutionRecord | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setRecords(await getExecutionRecords()); setPage(1); }
    catch (caught) { setError(caught instanceof Error ? caught.message : '加载执行记录失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => ({
    today: records.filter((record) => record.createdAt.startsWith(today)).length,
    complete: records.filter((record) => ['success', 'complete'].includes(record.status)).length,
    running: records.filter((record) => ['pending', 'running'].includes(record.status)).length,
    failed: records.filter((record) => ['failed', 'interrupted'].includes(record.status)).length
  }), [records, today]);
  const pageCount = Math.max(1, Math.ceil(records.length / EXECUTION_RECORDS_PAGE_SIZE));
  const visibleRecords = paginateExecutionRecords(records, Math.min(page, pageCount));

  return <div className="workspacePage executionRecordsPage">
    <div className="workspaceBreadcrumb">记录 / 执行记录</div>
    <header className="workspaceHeader"><div><h1>执行记录</h1><p>所有营销、商品和视频任务的统一历史记录。</p></div><button className="primaryButton" disabled={loading} onClick={() => void refresh()} type="button">{loading ? '刷新中…' : '刷新记录'}</button></header>
    {error ? <div className="errorBanner">{error}</div> : null}
    <section className="workspaceSummary" aria-label="执行记录概览">
      <div><span>今日执行</span><strong>{stats.today}</strong></div><div><span>已完成</span><strong>{stats.complete}</strong></div><div><span>执行中</span><strong>{stats.running}</strong></div><div><span>失败</span><strong>{stats.failed}</strong></div>
    </section>
    {!loading && records.length === 0 ? <section className="workspaceCard workspaceEmptyState"><strong>还没有执行记录</strong><span>开始执行任务后，历史记录会显示在这里。</span></section> : <>
      <section className="executionRecordList">
      {visibleRecords.map((record) => <article className="workspaceCard executionRecordCard" key={record.id}>
        <button aria-haspopup="dialog" className="executionRecordSummary" onClick={() => setSelectedRecord(record)} type="button">
          <span className="executionRecordTitle"><b>{labels[record.kind] ?? '其他任务'}</b><strong>{record.title}</strong></span>
          <span className={`executionRecordStatus ${record.status}`}>{statusLabels[record.status] ?? '未知状态'}</span>
          <span className="executionRecordMeta">{record.successCount}/{record.totalCount} 成功 · {new Date(record.createdAt).toLocaleString()}</span>
          <span aria-hidden="true">展开</span>
        </button>
      </article>)}
      </section>
      {records.length > EXECUTION_RECORDS_PAGE_SIZE ? <nav className="executionPagination" aria-label="执行记录分页">
        <button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">上一页</button>
        <span>第 {Math.min(page, pageCount)} / {pageCount} 页 · 共 {records.length} 条</span>
        <button disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} type="button">下一页</button>
      </nav> : null}
    </>}
    {selectedRecord ? <ExecutionRecordDialog record={selectedRecord} onClose={() => setSelectedRecord(null)} /> : null}
  </div>;
}

export function ExecutionRecordDialog({ record, onClose }: { record: ExecutionRecord; onClose(): void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return <div className="executionRecordDialogBackdrop" onMouseDown={onClose}>
    <div aria-labelledby="execution-record-dialog-title" aria-modal="true" className="executionRecordDialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
      <header className="executionRecordDialogHeader"><div><span>{labels[record.kind] ?? '其他任务'}</span><h2 id="execution-record-dialog-title">{record.title}</h2><p>成功 {record.successCount} 条 · 失败 {record.failedCount} 条</p></div><button aria-label="关闭失败详情" className="executionRecordDialogClose" onClick={onClose} type="button">×</button></header>
      <div className="executionRecordDialogBody"><ExecutionRecordDetails record={record} /></div>
      <footer className="executionRecordDialogFooter"><button onClick={onClose} type="button">关闭</button></footer>
    </div>
  </div>;
}

function ExecutionRecordDetails({ record }: { record: ExecutionRecord }) {
  const skuSummary = summarizeExecutionSkus(record.tasks);
  const failures = visibleExecutionFailures(record.tasks);
  return <div className="executionRecordDetails">
    <div className="executionDetailStats"><span>成功 <b>{record.successCount}</b></span><span>失败 <b>{record.failedCount}</b></span></div>
    {skuSummary.visible.length ? <div className="executionSkuBlock"><span className="executionDetailLabel">执行款号</span><div className="executionSkuList">{skuSummary.visible.map((sku) => <span className="executionSku" key={sku}>{sku}</span>)}{skuSummary.remaining ? <span className="executionSkuMore">+{skuSummary.remaining}</span> : null}</div></div> : null}
    {failures.length ? <div className="executionFailureList"><span className="executionDetailLabel">失败明细</span>{failures.map((task) => <div className="executionTask" key={task.id}><span className="logDot failed" /><span><b>{task.sku || '未记录款号'}</b>{task.message ? ` · ${friendlyExecutionMessage(task.message)}` : ' · 任务失败'}</span></div>)}</div> : <p className="executionNoFailures">本批次没有失败明细</p>}
  </div>;
}
