import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import type { CouponBatch, CouponRow, NewcomerGiftBatch, NewcomerGiftRow, Shop } from '../shared/types';
import { normalizeCouponRow, validateCouponBatchTime, validateCouponRow } from '../imports/couponRows';
import { normalizeNewcomerGiftRow, validateNewcomerGiftRow } from '../imports/newcomerGiftRows';
import { createCouponBatch, createNewcomerGiftBatch, getCouponBatch, getNewcomerGiftBatch, getShops, stopCouponBatch, stopNewcomerGiftBatch } from './api';
import { ShopList } from './pages/shops/ShopList';

type Page =
  | 'shops'
  | 'accountStatus'
  | 'coupon'
  | 'newcomerGift'
  | 'productSearch'
  | 'titleCheck'
  | 'videoFrameExtraction'
  | 'tableTemplates'
  | 'executionRecords'
  | 'settings';
type RawImportRow = Record<string, string>;
type CouponPreviewRow = {
  rowNumber: number;
  raw: RawImportRow;
  coupon: CouponRow | null;
  errors: string[];
};
type NewcomerGiftPreviewRow = {
  rowNumber: number;
  raw: RawImportRow;
  gift: NewcomerGiftRow | null;
  errors: string[];
};

export function App() {
  const [page, setPage] = useState<Page>('shops');
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingShops, setRefreshingShops] = useState(false);
  const [shopsRefreshedAt, setShopsRefreshedAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    shop: true,
    marketing: true,
    product: true,
    video: true,
    records: true
  });

  async function refreshShops() {
    setError('');
    setRefreshingShops(true);
    try {
      setShops(await getShops());
      setShopsRefreshedAt(new Date().toISOString());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '加载失败');
    } finally {
      setLoading(false);
      setRefreshingShops(false);
    }
  }

  useEffect(() => {
    void refreshShops();
    const timer = window.setInterval(() => void refreshShops(), 3000);
    return () => window.clearInterval(timer);
  }, []);

  const currentShop = useMemo(
    () => shops.find((shop) => shop.current) ?? shops[0],
    [shops]
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">店</div>
          <div>
            <strong>抖店助手</strong>
            <span>本地工具</span>
          </div>
        </div>

        <div className="currentShopBox">
          <span>当前店铺</span>
          <strong>{currentShop?.name ?? '未选择店铺'}</strong>
          <small>{shops.length} 个店铺 · {currentShop?.officialAccountName ?? '未绑定账号'}</small>
        </div>

        <NavGroup
          open={openGroups.shop}
          title="店铺"
          onToggle={() => setOpenGroups(toggleGroup('shop'))}
        >
          <button className={navClass(page === 'shops')} onClick={() => setPage('shops')}>
            <span>店铺列表</span><b>{shops.length}</b>
          </button>
          <button className={navClass(page === 'accountStatus')} onClick={() => setPage('accountStatus')}>账号状态</button>
        </NavGroup>

        <NavGroup
          open={openGroups.marketing}
          title="营销"
          onToggle={() => setOpenGroups(toggleGroup('marketing'))}
        >
          <div className="navParent">营销工具</div>
          <div className="subNav">
            <button className={navClass(page === 'coupon', 'subItem')} onClick={() => setPage('coupon')}>
              建立优惠券
            </button>
            <button className={navClass(page === 'newcomerGift', 'subItem')} onClick={() => setPage('newcomerGift')}>
              建立新人礼金
            </button>
          </div>
        </NavGroup>

        <NavGroup
          open={openGroups.product}
          title="商品"
          onToggle={() => setOpenGroups(toggleGroup('product'))}
        >
          <div className="navParent">商品工具</div>
          <div className="subNav">
            <button className={navClass(page === 'productSearch', 'subItem')} onClick={() => setPage('productSearch')}>商品搜索</button>
            <button className={navClass(page === 'titleCheck', 'subItem')} onClick={() => setPage('titleCheck')}>标题检查</button>
          </div>
        </NavGroup>

        <NavGroup
          open={openGroups.video}
          title="视频"
          onToggle={() => setOpenGroups(toggleGroup('video'))}
        >
          <div className="navParent">视频工具</div>
          <div className="subNav">
            <button
              className={navClass(page === 'videoFrameExtraction', 'subItem')}
              onClick={() => setPage('videoFrameExtraction')}
              type="button"
            >
              视频抽帧
            </button>
          </div>
        </NavGroup>

        <NavGroup
          open={openGroups.records}
          title="记录"
          onToggle={() => setOpenGroups(toggleGroup('records'))}
        >
          <button className={navClass(page === 'tableTemplates')} onClick={() => setPage('tableTemplates')}>表格模板</button>
          <button className={navClass(page === 'executionRecords')} onClick={() => setPage('executionRecords')}>执行记录</button>
        </NavGroup>

        <div className="sidebarFooter">
          <button className={navClass(page === 'settings')} onClick={() => setPage('settings')}>设置</button>
        </div>
      </aside>

      <main className={page === 'videoFrameExtraction' ? 'main videoFrameMain' : 'main'}>
        {error ? <div className="errorBanner">{error}</div> : null}
        {page === 'shops' ? (
          <ShopList
            shops={shops}
            loading={loading}
            onChanged={refreshShops}
            refreshing={refreshingShops}
            refreshedAt={shopsRefreshedAt}
          />
        ) : page === 'accountStatus' ? (
          <WorkspacePlaceholder
            actionLabel="刷新状态"
            breadcrumb="店铺 / 账号状态"
            description="集中查看店铺授权与登录状态。"
            emptyDescription="绑定店铺后，会在这里显示账号状态。"
            emptyTitle="还没有可查看的账号"
            summary={[
              { label: '已登录', value: String(shops.filter((shop) => shop.status === 'active').length) },
              { label: '需登录', value: String(shops.filter((shop) => shop.status !== 'active').length) },
              { label: '店铺总数', value: String(shops.length) }
            ]}
            title="账号状态"
          />
        ) : page === 'newcomerGift' ? (
          <NewcomerGiftWorkbench currentShop={currentShop} shops={shops} />
        ) : page === 'videoFrameExtraction' ? (
          <VideoFrameRateWorkbench />
        ) : page === 'productSearch' ? (
          <WorkspacePlaceholder
            actionLabel="开始搜索"
            breadcrumb="商品 / 商品搜索"
            description="按关键词定位店铺商品。"
            emptyDescription="输入商品关键词后，结果会显示在这里。"
            emptyTitle="还没有搜索结果"
            summary={[{ label: '今日搜索', value: '0' }, { label: '可查看商品', value: '0' }, { label: '当前店铺', value: currentShop ? '已选择' : '未选择' }]}
            title="商品搜索"
          />
        ) : page === 'titleCheck' ? (
          <WorkspacePlaceholder
            actionLabel="检查标题"
            breadcrumb="商品 / 标题检查"
            description="检查商品标题的关键词与规范。"
            emptyDescription="粘贴商品标题后，检查结果会显示在这里。"
            emptyTitle="还没有检查记录"
            summary={[{ label: '今日检查', value: '0' }, { label: '通过', value: '0' }, { label: '需修改', value: '0' }]}
            title="标题检查"
          />
        ) : page === 'tableTemplates' ? (
          <WorkspacePlaceholder
            actionLabel="下载模板"
            breadcrumb="记录 / 表格模板"
            description="下载并管理营销任务的导入表格。"
            emptyDescription="可在这里下载优惠券和新人礼金模板。"
            emptyTitle="还没有自定义模板"
            summary={[{ label: '可用模板', value: '2' }, { label: '最近下载', value: '—' }, { label: '自定义模板', value: '0' }]}
            title="表格模板"
          />
        ) : page === 'executionRecords' ? (
          <WorkspacePlaceholder
            actionLabel="刷新记录"
            breadcrumb="记录 / 执行记录"
            description="查看营销、商品和视频任务的执行历史。"
            emptyDescription="开始执行任务后，历史记录会显示在这里。"
            emptyTitle="还没有执行记录"
            summary={[{ label: '今日执行', value: '0' }, { label: '已完成', value: '0' }, { label: '执行中', value: '0' }]}
            title="执行记录"
          />
        ) : page === 'settings' ? (
          <WorkspacePlaceholder
            actionLabel="保存设置"
            breadcrumb="设置"
            description="管理本地工具的基础设置。"
            emptyDescription="设置项会在这里展示。"
            emptyTitle="还没有可修改的设置"
            summary={[{ label: '当前店铺', value: currentShop ? '已选择' : '未选择' }, { label: '本地数据', value: '正常' }, { label: '版本', value: '0.1.0' }]}
            title="设置"
          />
        ) : (
          <CouponWorkbench currentShop={currentShop} shops={shops} />
        )}
      </main>
    </div>
  );
}

export function WorkspacePlaceholder(props: {
  breadcrumb: string;
  title: string;
  description: string;
  actionLabel: string;
  summary: Array<{ label: string; value: string }>;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <div className="workspacePage">
      <div className="workspaceBreadcrumb">{props.breadcrumb}</div>
      <header className="workspaceHeader">
        <div>
          <h1>{props.title}</h1>
          <p>{props.description}</p>
        </div>
        <button className="primaryButton" type="button">{props.actionLabel}</button>
      </header>
      <section className="workspaceSummary" aria-label={`${props.title}概览`}>
        {props.summary.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
      </section>
      <section className="workspaceCard workspaceEmptyState">
        <strong>{props.emptyTitle}</strong>
        <span>{props.emptyDescription}</span>
      </section>
    </div>
  );
}

type VideoProcessingState = 'idle' | 'reading' | 'encoding' | 'complete';
type VideoMetadata = {
  duration: number;
  height: number;
  width: number;
};

export function VideoFrameRateWorkbench() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timersRef = useRef<number[]>([]);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [targetFps, setTargetFps] = useState(15);
  const [processingState, setProcessingState] = useState<VideoProcessingState>('idle');

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, [sourceUrl]);

  function chooseVideo(file: File | undefined) {
    if (!file) return;
    setSourceFile(file);
    setSourceUrl(URL.createObjectURL(file));
    setMetadata(null);
    setProcessingState('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function startProcessing() {
    if (!sourceFile) return;
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    setProcessingState('reading');
    timersRef.current = [
      window.setTimeout(() => setProcessingState('encoding'), 700),
      window.setTimeout(() => setProcessingState('complete'), 1400)
    ];
  }

  const progress = processingState === 'reading' ? 20 : processingState === 'encoding' ? 65 : processingState === 'complete' ? 100 : 0;
  const status = processingState === 'reading'
    ? '正在读取视频'
    : processingState === 'encoding'
      ? '正在重新编码'
      : processingState === 'complete'
        ? '处理完成'
        : '等待开始处理';
  const outputName = sourceFile ? `${sourceFile.name.replace(/\.[^.]+$/, '')}_${targetFps}fps.mp4` : '处理后视频.mp4';

  return (
    <div className="videoFramePage">
      <div className="pageHeader">
        <div>
          <h1>视频抽帧</h1>
          <p>降低视频帧率，保留原时长和原声音。</p>
        </div>
      </div>

      <section className="videoFrameGrid" aria-label="视频抽帧工作区">
        <section className="workspaceCard videoFramePanel videoFrameSourcePanel videoFrameSourceCard" aria-labelledby="video-source-title">
          <h2 id="video-source-title">源视频与参数</h2>
          <div className="videoFrameUpload">
            <strong>导入本地视频</strong>
            <span>支持 MP4</span>
            <button onClick={() => fileInputRef.current?.click()} type="button">选择视频</button>
            <input
              ref={fileInputRef}
              accept="video/mp4"
              className="hiddenInput"
              onChange={(event) => chooseVideo(event.target.files?.[0])}
              type="file"
            />
          </div>

          <div className="videoFrameFileRow">
            <span>源文件</span>
            <strong>{sourceFile?.name ?? '未选择视频'}</strong>
          </div>
          <div className="videoFramePreview">
            <video
              className="videoFramePlayer"
              controls
              onLoadedMetadata={(event) => setMetadata({
                duration: event.currentTarget.duration,
                height: event.currentTarget.videoHeight,
                width: event.currentTarget.videoWidth
              })}
              src={sourceUrl || undefined}
            />
          </div>

          <dl className="videoFrameMetadata">
            <div><dt>视频时长</dt><dd>{metadata ? formatVideoDuration(metadata.duration) : '—'}</dd></div>
            <div><dt>文件大小</dt><dd>{sourceFile ? formatFileSize(sourceFile.size) : '—'}</dd></div>
            <div><dt>视频分辨率</dt><dd>{metadata ? `${metadata.width} × ${metadata.height}` : '—'}</dd></div>
            <div><dt>原始帧率</dt><dd>加载后识别</dd></div>
          </dl>

          <div className="videoFrameSettings">
            <h3>抽帧设置</h3>
            <label className="videoFrameFpsField">
              <span>目标帧率</span>
              <input
                aria-label="目标帧率"
                max={60}
                min={1}
                onChange={(event) => setTargetFps(Math.max(1, Math.min(60, Number(event.target.value) || 1)))}
                type="number"
                value={targetFps}
              />
              <b>FPS</b>
            </label>
            <div className="videoFrameOutputSelect">输出：MP4 · 保留原声</div>
            <p>视频播放速度保持不变</p>
            <button className="primaryButton videoFrameStartButton" disabled={!sourceFile || processingState === 'reading' || processingState === 'encoding'} onClick={startProcessing} type="button">
              {processingState === 'reading' || processingState === 'encoding' ? '处理中…' : '开始处理'}
            </button>
          </div>
        </section>

        <section className="workspaceCard videoFramePanel videoFrameOutputPanel videoFrameOutputCard" aria-labelledby="video-output-title">
          <header className="videoFramePanelHeader">
            <h2 id="video-output-title">输出视频</h2>
            {processingState === 'complete' && sourceUrl ? (
              <a className="videoFrameDownloadButton" download={outputName} href={sourceUrl}>下载视频</a>
            ) : <button disabled type="button">下载视频</button>}
          </header>
          <div className="videoFramePreview videoFrameOutputPreview">
            <video className="videoFramePlayer" controls src={processingState === 'complete' ? sourceUrl : undefined} />
            {processingState !== 'complete' ? <span>处理完成后，新视频将在这里预览</span> : null}
          </div>

          <section className="videoFrameProgress" aria-live="polite" aria-label="处理进度">
            <div className="videoFrameProgressTitle"><strong>处理进度</strong><b>{progress}%</b></div>
            <div className="videoFrameProgressTrack"><i style={{ width: `${progress}%` }} /></div>
            <p>{status}</p>
            <div className="videoFrameStages">
              {['读取视频', '重新编码', '生成 MP4'].map((stage, index) => {
                const active = progress >= [20, 65, 100][index];
                return <span className={active ? 'active' : ''} key={stage}>{stage}</span>;
              })}
            </div>
          </section>

          <section className="videoFrameOutputInfo" aria-label="输出信息">
            <h3>输出信息</h3>
            <dl>
              <div><dt>输出时长</dt><dd>{processingState === 'complete' && metadata ? formatVideoDuration(metadata.duration) : '—'}</dd></div>
              <div><dt>输出帧率</dt><dd>{processingState === 'complete' ? `${targetFps} FPS` : '—'}</dd></div>
              <div><dt>输出大小</dt><dd>{processingState === 'complete' && sourceFile ? formatFileSize(sourceFile.size) : '—'}</dd></div>
            </dl>
          </section>
          <footer className="videoFrameStatus">{processingState === 'complete' ? '处理完成后可下载到本地' : `状态：${status}`}</footer>
        </section>
      </section>
    </div>
  );
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatVideoDuration(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  return [Math.floor(totalSeconds / 60), totalSeconds % 60].map((part) => String(part).padStart(2, '0')).join(':');
}

function NavGroup(props: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="navGroup">
      <button
        aria-expanded={props.open}
        className="navGroupToggle"
        onClick={props.onToggle}
        type="button"
      >
        <span>{props.title}</span>
        <i className={props.open ? 'groupChevron open' : 'groupChevron'} aria-hidden="true" />
      </button>
      {props.open ? <div className="navStack">{props.children}</div> : null}
    </section>
  );
}

function toggleGroup(key: string) {
  return (current: Record<string, boolean>) => ({
    ...current,
    [key]: !current[key]
  });
}

function navClass(active: boolean, base = 'navItem') {
  return active ? `${base} active` : base;
}

function NewcomerGiftWorkbench({ currentShop, shops }: { currentShop?: Shop; shops: Shop[] }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedShopId, setSelectedShopId] = useState(currentShop?.id ?? '');
  const [startTime, setStartTime] = useState('2026-08-28 00:00:00');
  const [endTime, setEndTime] = useState('2026-09-03 23:59:59');
  const [concurrency, setConcurrency] = useState(1);
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<RawImportRow[]>([]);
  const [runMessage, setRunMessage] = useState('');
  const [activeBatch, setActiveBatch] = useState<NewcomerGiftBatch | null>(null);
  const selectedShop = shops.find((shop) => shop.id === selectedShopId) ?? currentShop;
  const timeError = batchTimeError(startTime, endTime);
  const batchReady = Boolean(selectedShop && !timeError);
  const previewRows = useMemo(
    () => rawRows.map((row, index) => previewNewcomerGiftRow(row, index + 2, { startTime, endTime })),
    [endTime, rawRows, startTime]
  );
  const validRows = previewRows
    .map((row) => row.gift)
    .filter((row): row is NewcomerGiftRow => Boolean(row));
  const errorRows = previewRows.filter((row) => row.errors.length > 0);
  const canSubmit = batchReady && validRows.length > 0 && errorRows.length === 0;
  const activeTask = activeBatch?.tasks.find((task) => task.status === 'running')
    ?? activeBatch?.tasks.find((task) => task.status === 'waiting_confirm')
    ?? activeBatch?.tasks.find((task) => task.status === 'pending');
  const batchCounts = activeBatch ? countTaskStatus(activeBatch) : null;
  const runTotal = activeBatch?.totalCount ?? previewRows.length;
  const runDone = batchCounts ? batchCounts.success + batchCounts.failed + batchCounts.waiting_confirm : 0;
  const runProgress = runTotal > 0 ? Math.round((runDone / runTotal) * 100) : 0;
  const runState = runStateText(activeBatch, previewRows.length, errorRows.length);

  useEffect(() => {
    if (!selectedShopId && currentShop) {
      setSelectedShopId(currentShop.id);
    }
  }, [currentShop, selectedShopId]);

  useEffect(() => {
    if (!activeBatch || activeBatch.status === 'success' || activeBatch.status === 'failed') return;

    const timer = window.setInterval(async () => {
      setActiveBatch(await getNewcomerGiftBatch(activeBatch.id));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeBatch]);

  function downloadTemplate() {
    downloadWorkbook('新人礼金导入模板.xlsx', [
      ['款号', '礼金金额'],
      ['216704', '20']
    ]);
  }

  async function importTemplate(file: File | undefined) {
    if (!file) return;
    setRunMessage('正在识别新人礼金表格...');
    try {
      const rows = await readImportRows(file);
      setFileName(file.name);
      setRawRows(rows);
      setRunMessage(rows.length > 0 ? `已识别 ${rows.length} 行` : '表格为空');
    } catch (caught) {
      setFileName(file.name);
      setRawRows([]);
      setRunMessage(caught instanceof Error ? caught.message : '导入失败');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function checkRows() {
    if (previewRows.length === 0) {
      setRunMessage('请先导入模板');
      return;
    }
    setRunMessage(errorRows.length > 0
      ? `发现 ${errorRows.length} 行有问题，先按表格提示修改`
      : `${previewRows.length} 行都可以提交`);
  }

  async function submitImportedQueue() {
    if (!selectedShop || !canSubmit) return;
    setRunMessage(`正在提交 ${validRows.length} 条新人礼金任务，并发 ${concurrency} 个窗口...`);
    try {
      const batch = await createNewcomerGiftBatch({
        shopId: selectedShop.id,
        fileName: fileName || '手动导入',
        rows: validRows,
        concurrency
      });
      setActiveBatch(batch);
      setRunMessage(`新人礼金任务已提交，后台按 ${concurrency} 个窗口并发执行，成功后自动关闭页面。`);
    } catch (caught) {
      setRunMessage(caught instanceof Error ? caught.message : '提交任务失败');
    }
  }

  async function stopActiveBatch() {
    if (!activeBatch || activeBatch.status !== 'running') return;
    setRunMessage('正在停止新人礼金任务，已开始的页面会处理完当前提交，未开始的任务不再执行。');
    try {
      setActiveBatch(await stopNewcomerGiftBatch(activeBatch.id));
      setRunMessage('已发送停止指令，未开始的新人礼金任务已停止。');
    } catch (caught) {
      setRunMessage(caught instanceof Error ? caught.message : '停止任务失败');
    }
  }

  return (
    <>
      <div className="pageHeader">
        <div>
          <h1>新人礼金建立</h1>
          <p>先设置活动时间，再导入款号和礼金金额。</p>
        </div>
        <div className="buttonRow">
          <button onClick={downloadTemplate} type="button">下载模板</button>
          <button className="primaryButton" onClick={() => fileInputRef.current?.click()} type="button">导入表格</button>
          <input
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv,.txt,.tsv"
            className="hiddenInput"
            onChange={(event) => void importTemplate(event.target.files?.[0])}
            type="file"
          />
        </div>
      </div>

      <div className="notice">
        本批店铺：{selectedShop?.name ?? '未选择'}。自动续期、优惠范围和浮动面额按固定规则处理。
      </div>

      <section className="couponSettingsPanel" aria-labelledby="newcomer-gift-settings-title">
        <div className="couponSettingsHeader">
          <h2 id="newcomer-gift-settings-title">批次设置</h2>
          <span className={batchReady ? 'batchStatus ready' : 'batchStatus'}>
            {batchReady ? '已就绪' : '未完成'}
          </span>
        </div>
        <div className="timeFields">
          <label>
            执行店铺
            <select value={selectedShopId} onChange={(event) => setSelectedShopId(event.target.value)}>
              <option value="">请选择店铺</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
          </label>
          <DateTimePicker align="start" label="活动开始时间" value={startTime} onChange={setStartTime} />
          <DateTimePicker align="end" label="活动结束时间" value={endTime} onChange={setEndTime} />
          <label className="concurrencyField">
            并发窗口
            <input
              aria-label="并发窗口"
              max={5}
              min={1}
              onChange={(event) => setConcurrency(clampConcurrency(event.target.value))}
              type="number"
              value={concurrency}
            />
          </label>
        </div>
        <div className="timeTools" aria-live="polite">
          <div className={timeError ? 'timeSummary error' : 'timeSummary'}>
            {timeError || `${startTime} 至 ${endTime}`}
          </div>
        </div>
      </section>

      <section className="couponGrid">
        <div className="panel tablePanel">
          <div className="panelHeader">
            <div>
              <h2>表格预览</h2>
              <p>{fileName ? `${fileName} · ${previewRows.length} 行` : '下载模板后填写款号和礼金金额，再导入识别'}</p>
            </div>
            <div className="buttonRow">
              <button onClick={checkRows} type="button">检查数据</button>
              <button className="primaryButton" disabled={!canSubmit} onClick={() => void submitImportedQueue()}>
                提交礼金任务
              </button>
            </div>
          </div>
          {previewRows.length > 0 ? (
            <div className="couponTableWrap">
              <table className="couponTable">
                <thead>
                  <tr>
                    <th>款号</th>
                    <th>活动名称</th>
                    <th>礼金金额</th>
                    <th>商品搜索</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => {
                    const task = activeBatch?.tasks[index];
                    return (
                      <tr key={`${row.rowNumber}-${row.raw['款号'] ?? index}`}>
                        <td>{row.raw['款号'] || row.raw['商品编码'] || '--'}</td>
                        <td>{row.gift?.activityName ?? '--'}</td>
                        <td>{row.raw['礼金金额'] || '--'}</td>
                        <td>{row.gift?.productSearchKeyword ?? '--'}</td>
                        <td>
                          <span className={`rowStatus ${row.errors.length > 0 ? 'failed' : task?.status ?? 'pending'}`}>
                            {row.errors[0] ?? taskStatusText(task?.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="emptyTableState">
              <strong>还没有导入表格</strong>
              <span>模板只需要填：款号、礼金金额。</span>
            </div>
          )}
        </div>

        <aside className={`panel runPanel run-${runState.className}`} aria-live="polite">
          <div className="runPanelHeader">
            <h2>当前执行</h2>
            <div className="runHeaderActions">
              {activeBatch?.status === 'running' ? (
                <button className="dangerButton" onClick={() => void stopActiveBatch()} type="button">停止</button>
              ) : null}
              <span className={`runState ${runState.className}`}>{runState.label}</span>
            </div>
          </div>
          <div className="runFocus">
            <span>当前款号</span>
            <strong>{activeTask?.activityName ?? '--'}</strong>
            <p>{runMessage || '导入模板后，可以在这里看当前处理的款号。'}</p>
          </div>
          <div className="runProgressBlock">
            <div className="runProgressMeta">
              <span>整体进度</span>
              <b>{runProgress}%</b>
            </div>
            <div className="runProgressTrack" aria-label="整体进度">
              <i style={{ width: `${runProgress}%` }} />
            </div>
          </div>
          {batchCounts ? (
            <div className="runStats" aria-label="任务进度">
              <span>总数 <b>{activeBatch?.totalCount ?? 0}</b></span>
              <span>执行中 <b>{batchCounts.running}</b></span>
              <span>待确认 <b>{batchCounts.waiting_confirm}</b></span>
              <span>失败 <b>{batchCounts.failed}</b></span>
            </div>
          ) : (
            <div className="runStats">
              <span>已导入 <b>{previewRows.length}</b></span>
              <span>可提交 <b>{validRows.length}</b></span>
              <span>错误 <b>{errorRows.length}</b></span>
            </div>
          )}
          <div className="logBox">
            <strong>执行记录</strong>
            {activeBatch ? (
              activeBatch.tasks.map((task) => (
                <div className="logLine" key={task.id}>
                  <span className={`logDot ${task.status}`} aria-hidden="true" />
                  <span>{task.activityName}：{taskStatusText(task.status)}{task.errorMessage ? `（${task.errorMessage}）` : ''}</span>
                </div>
              ))
            ) : <div className="logEmpty">暂无执行记录</div>}
          </div>
        </aside>
      </section>
    </>
  );
}

function CouponWorkbench({ currentShop, shops }: { currentShop?: Shop; shops: Shop[] }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedShopId, setSelectedShopId] = useState(currentShop?.id ?? '');
  const [startTime, setStartTime] = useState('2026-08-28 00:00:00');
  const [endTime, setEndTime] = useState('2026-09-03 23:59:59');
  const [concurrency, setConcurrency] = useState(1);
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<RawImportRow[]>([]);
  const [runMessage, setRunMessage] = useState('');
  const [activeBatch, setActiveBatch] = useState<CouponBatch | null>(null);
  const selectedShop = shops.find((shop) => shop.id === selectedShopId) ?? currentShop;
  const timeError = batchTimeError(startTime, endTime);
  const batchReady = Boolean(selectedShop && !timeError);
  const previewRows = useMemo(
    () => rawRows.map((row, index) => previewCouponRow(row, index + 2, { startTime, endTime })),
    [endTime, rawRows, startTime]
  );
  const validRows = previewRows
    .map((row) => row.coupon)
    .filter((row): row is CouponRow => Boolean(row));
  const errorRows = previewRows.filter((row) => row.errors.length > 0);
  const canSubmit = batchReady && validRows.length > 0 && errorRows.length === 0;
  const activeTask = activeBatch?.tasks.find((task) => task.status === 'running')
    ?? activeBatch?.tasks.find((task) => task.status === 'waiting_confirm')
    ?? activeBatch?.tasks.find((task) => task.status === 'pending');
  const batchCounts = activeBatch ? countTaskStatus(activeBatch) : null;
  const runTotal = activeBatch?.totalCount ?? previewRows.length;
  const runDone = batchCounts ? batchCounts.success + batchCounts.failed + batchCounts.waiting_confirm : 0;
  const runProgress = runTotal > 0 ? Math.round((runDone / runTotal) * 100) : 0;
  const runState = runStateText(activeBatch, previewRows.length, errorRows.length);

  useEffect(() => {
    if (!selectedShopId && currentShop) {
      setSelectedShopId(currentShop.id);
    }
  }, [currentShop, selectedShopId]);

  useEffect(() => {
    if (!activeBatch || activeBatch.status === 'success' || activeBatch.status === 'failed') return;

    const timer = window.setInterval(async () => {
      setActiveBatch(await getCouponBatch(activeBatch.id));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeBatch]);

  function downloadTemplate() {
    downloadWorkbook('涨粉券导入模板.xlsx', [
      ['款号', '满减门槛', '减免金额'],
      ['216704', '300', '5']
    ]);
  }

  async function importTemplate(file: File | undefined) {
    if (!file) return;
    setRunMessage('正在识别表格...');
    try {
      const rows = await readImportRows(file);
      setFileName(file.name);
      setRawRows(rows);
      setRunMessage(rows.length > 0 ? `已识别 ${rows.length} 行` : '表格为空');
    } catch (caught) {
      setFileName(file.name);
      setRawRows([]);
      setRunMessage(caught instanceof Error ? caught.message : '导入失败');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function checkRows() {
    if (previewRows.length === 0) {
      setRunMessage('请先导入模板');
      return;
    }
    setRunMessage(errorRows.length > 0
      ? `发现 ${errorRows.length} 行有问题，先按表格提示修改`
      : `${previewRows.length} 行都可以提交`);
  }

  async function submitImportedQueue() {
    if (!selectedShop || !canSubmit) return;
    setRunMessage(`正在提交 ${validRows.length} 条建券任务，并发 ${concurrency} 个窗口...`);
    try {
      const batch = await createCouponBatch({
        shopId: selectedShop.id,
        fileName: fileName || '手动导入',
        rows: validRows,
        concurrency
      });
      setActiveBatch(batch);
      setRunMessage(`任务已提交，后台按 ${concurrency} 个窗口并发执行，成功后自动关闭建券页。`);
    } catch (caught) {
      setRunMessage(caught instanceof Error ? caught.message : '提交任务失败');
    }
  }

  async function stopActiveBatch() {
    if (!activeBatch || activeBatch.status !== 'running') return;
    setRunMessage('正在停止建券任务，已开始的页面会处理完当前提交，未开始的任务不再执行。');
    try {
      setActiveBatch(await stopCouponBatch(activeBatch.id));
      setRunMessage('已发送停止指令，未开始的建券任务已停止。');
    } catch (caught) {
      setRunMessage(caught instanceof Error ? caught.message : '停止任务失败');
    }
  }

  return (
    <>
      <div className="pageHeader">
        <div>
          <h1>涨粉券建立</h1>
          <p>先设置本批领取时间，再导入款号和满减金额。</p>
        </div>
        <div className="buttonRow">
          <button onClick={downloadTemplate} type="button">下载模板</button>
          <button className="primaryButton" onClick={() => fileInputRef.current?.click()} type="button">导入表格</button>
          <input
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv,.txt,.tsv"
            className="hiddenInput"
            onChange={(event) => void importTemplate(event.target.files?.[0])}
            type="file"
          />
        </div>
      </div>

      <div className="notice">
        本批店铺：{selectedShop?.name ?? '未选择'}。涨粉账户、有效天数、续期、发放量、限领和商品范围按固定规则处理。
      </div>

      <section className="couponSettingsPanel" aria-labelledby="coupon-settings-title">
        <div className="couponSettingsHeader">
          <h2 id="coupon-settings-title">批次设置</h2>
          <span className={batchReady ? 'batchStatus ready' : 'batchStatus'}>
            {batchReady ? '已就绪' : '未完成'}
          </span>
        </div>
        <div className="timeFields">
          <label>
            执行店铺
            <select value={selectedShopId} onChange={(event) => setSelectedShopId(event.target.value)}>
              <option value="">请选择店铺</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
          </label>
          <DateTimePicker align="start" label="领取开始时间" value={startTime} onChange={setStartTime} />
          <DateTimePicker align="end" label="领取结束时间" value={endTime} onChange={setEndTime} />
          <label className="concurrencyField">
            并发窗口
            <input
              aria-label="并发窗口"
              max={5}
              min={1}
              onChange={(event) => setConcurrency(clampConcurrency(event.target.value))}
              type="number"
              value={concurrency}
            />
          </label>
        </div>
        <div className="timeTools" aria-live="polite">
          <div className={timeError ? 'timeSummary error' : 'timeSummary'}>
            {timeError || `${startTime} 至 ${endTime}`}
          </div>
        </div>
      </section>

      <section className="couponGrid">
        <div className="panel tablePanel">
          <div className="panelHeader">
            <div>
              <h2>表格预览</h2>
              <p>{fileName ? `${fileName} · ${previewRows.length} 行` : '下载模板后填写款号和金额，再导入识别'}</p>
            </div>
            <div className="buttonRow">
              <button onClick={checkRows} type="button">检查数据</button>
              <button className="primaryButton" disabled={!canSubmit} onClick={() => void submitImportedQueue()}>
                提交建券任务
              </button>
            </div>
          </div>
          {previewRows.length > 0 ? (
            <div className="couponTableWrap">
              <table className="couponTable">
                <thead>
                  <tr>
                    <th>款号</th>
                    <th>优惠券名称</th>
                    <th>满减门槛</th>
                    <th>减免金额</th>
                    <th>商品搜索</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => {
                    const task = activeBatch?.tasks[index];
                    return (
                      <tr key={`${row.rowNumber}-${row.raw['款号'] ?? index}`}>
                        <td>{row.raw['款号'] || row.raw['商品编码'] || '--'}</td>
                        <td>{row.coupon?.couponName ?? '--'}</td>
                        <td>{row.raw['满减门槛'] || '--'}</td>
                        <td>{row.raw['减免金额'] || '--'}</td>
                        <td>{row.coupon?.productSearchKeyword ?? '--'}</td>
                        <td>
                          <span className={`rowStatus ${row.errors.length > 0 ? 'failed' : task?.status ?? 'pending'}`}>
                            {row.errors[0] ?? taskStatusText(task?.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="emptyTableState">
              <strong>还没有导入表格</strong>
              <span>模板只需要填：款号、满减门槛、减免金额。</span>
            </div>
          )}
        </div>

        <aside className={`panel runPanel run-${runState.className}`} aria-live="polite">
          <div className="runPanelHeader">
            <h2>当前执行</h2>
            <div className="runHeaderActions">
              {activeBatch?.status === 'running' ? (
                <button className="dangerButton" onClick={() => void stopActiveBatch()} type="button">停止</button>
              ) : null}
              <span className={`runState ${runState.className}`}>{runState.label}</span>
            </div>
          </div>
          <div className="runFocus">
            <span>当前款号</span>
            <strong>{activeTask?.couponName ?? '--'}</strong>
            <p>{runMessage || '导入模板后，可以在这里看当前处理的款号。'}</p>
          </div>
          <div className="runProgressBlock">
            <div className="runProgressMeta">
              <span>整体进度</span>
              <b>{runProgress}%</b>
            </div>
            <div className="runProgressTrack" aria-label="整体进度">
              <i style={{ width: `${runProgress}%` }} />
            </div>
          </div>
          {batchCounts ? (
            <div className="runStats" aria-label="任务进度">
              <span>总数 <b>{activeBatch?.totalCount ?? 0}</b></span>
              <span>执行中 <b>{batchCounts.running}</b></span>
              <span>待确认 <b>{batchCounts.waiting_confirm}</b></span>
              <span>失败 <b>{batchCounts.failed}</b></span>
            </div>
          ) : (
            <div className="runStats">
              <span>已导入 <b>{previewRows.length}</b></span>
              <span>可提交 <b>{validRows.length}</b></span>
              <span>错误 <b>{errorRows.length}</b></span>
            </div>
          )}
          <div className="logBox">
            <strong>执行记录</strong>
            {activeBatch ? (
              activeBatch.tasks.map((task) => (
                <div className="logLine" key={task.id}>
                  <span className={`logDot ${task.status}`} aria-hidden="true" />
                  <span>{task.couponName}：{taskStatusText(task.status)}{task.errorMessage ? `（${task.errorMessage}）` : ''}</span>
                </div>
              ))
            ) : <div className="logEmpty">暂无执行记录</div>}
          </div>
        </aside>
      </section>
    </>
  );
}

function previewCouponRow(row: RawImportRow, rowNumber: number, time: { startTime: string; endTime: string }): CouponPreviewRow {
  const errors = [...validateCouponRow(row), ...validateCouponBatchTime(time)];
  return {
    rowNumber,
    raw: row,
    coupon: errors.length > 0 ? null : normalizeCouponRow(row, time),
    errors
  };
}

function previewNewcomerGiftRow(row: RawImportRow, rowNumber: number, time: { startTime: string; endTime: string }): NewcomerGiftPreviewRow {
  const errors = [...validateNewcomerGiftRow(row), ...validateCouponBatchTime(time)];
  return {
    rowNumber,
    raw: row,
    gift: errors.length > 0 ? null : normalizeNewcomerGiftRow(row, time),
    errors
  };
}

function downloadWorkbook(fileName: string, rows: string[][]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, '导入模板');
  const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadBlob(fileName, new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function readImportRows(file: File): Promise<RawImportRow[]> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error('Excel 文件没有工作表');
    return rowsFromTable(XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '', raw: false }));
  }

  if (/\.(csv|txt|tsv)$/i.test(file.name)) {
    return parseDelimitedRows(await file.text());
  }

  throw new Error('请导入 Excel 或 CSV 表格');
}

function parseDelimitedRows(text: string): RawImportRow[] {
  const cleanText = text.replace(/^\uFEFF/, '');
  const delimiter = cleanText.split(/\r?\n/, 1)[0]?.includes('\t') ? '\t' : ',';
  return rowsFromTable(parseDelimitedText(cleanText, delimiter));
}

function rowsFromTable(table: string[][]): RawImportRow[] {
  const [headers = [], ...rows] = table;
  const normalizedHeaders = headers.map((header) => String(header).trim());

  if (!normalizedHeaders.includes('款号')) {
    throw new Error('表格缺少“款号”列，请先下载模板填写');
  }

  return rows
    .filter((row) => row.some((cell) => String(cell).trim()))
    .map((row) => Object.fromEntries(
      normalizedHeaders.map((header, index) => [header, String(row[index] ?? '').trim()])
    ));
}

function parseDelimitedText(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function countTaskStatus(batch: CouponBatch | NewcomerGiftBatch) {
  return batch.tasks.reduce<Record<string, number>>((counts, task) => {
    counts[task.status] = (counts[task.status] ?? 0) + 1;
    return counts;
  }, {
    pending: 0,
    running: 0,
    waiting_confirm: 0,
    success: 0,
    failed: 0
  });
}

function taskStatusText(status?: string) {
  if (status === 'running') return '执行中';
  if (status === 'waiting_confirm') return '待确认';
  if (status === 'success') return '完成';
  if (status === 'failed') return '失败';
  return '待提交';
}

function runStateText(batch: CouponBatch | NewcomerGiftBatch | null, importedCount: number, errorCount: number) {
  if (batch?.status === 'running') return { label: '执行中', className: 'running' };
  if (batch?.status === 'waiting_confirm') return { label: '待确认', className: 'waiting' };
  if (batch?.status === 'success') return { label: '已完成', className: 'success' };
  if (batch?.status === 'failed' || batch?.status === 'partial') return { label: '有失败', className: 'failed' };
  if (errorCount > 0) return { label: '需修正', className: 'failed' };
  if (importedCount > 0) return { label: '待提交', className: 'ready' };
  return { label: '未开始', className: 'idle' };
}

function DateTimePicker(props: {
  align: 'start' | 'end';
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const parsedValue = parseDateTime(props.value) ?? new Date();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(parsedValue);
  const [month, setMonth] = useState(startOfMonth(parsedValue));

  useEffect(() => {
    if (!open) {
      const next = parseDateTime(props.value) ?? new Date();
      setDraft(next);
      setMonth(startOfMonth(next));
    }
  }, [open, props.value]);

  function setDraftTime(part: 'hours' | 'minutes' | 'seconds', rawValue: string) {
    const next = new Date(draft);
    const value = Number(rawValue);
    if (part === 'hours') next.setHours(value);
    if (part === 'minutes') next.setMinutes(value);
    if (part === 'seconds') next.setSeconds(value);
    setDraft(next);
  }

  function selectDate(day: Date) {
    const next = new Date(day);
    next.setHours(draft.getHours(), draft.getMinutes(), draft.getSeconds(), 0);
    setDraft(next);
  }

  function confirm() {
    props.onChange(formatDateTime(draft));
    setOpen(false);
  }

  return (
    <div className={`dateTimePicker ${props.align === 'end' ? 'alignEnd' : 'alignStart'}`}>
      <span className="dateTimeLabel">{props.label}</span>
      <button
        aria-expanded={open}
        className="dateTimeButton"
        onClick={() => setOpen(!open)}
        type="button"
      >
        {props.value || '请选择时间'}
      </button>

      {open ? (
        <div className="datePopover">
          <div className="calendarPane">
            <div className="calendarHeader">
              <button type="button" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
              <strong>{month.getFullYear()}年{pad(month.getMonth() + 1)}月</strong>
              <button type="button" onClick={() => setMonth(addMonths(month, 1))}>›</button>
            </div>
            <div className="calendarWeek">
              {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="calendarDays">
              {calendarDays(month).map((day) => {
                const active = sameDate(day, draft);
                const outside = day.getMonth() !== month.getMonth();
                return (
                  <button
                    className={[
                      'calendarDay',
                      active ? 'selected' : '',
                      outside ? 'outside' : ''
                    ].filter(Boolean).join(' ')}
                    key={day.toISOString()}
                    onClick={() => selectDate(day)}
                    type="button"
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="timePane">
            <strong>时间</strong>
            <div className="timeColumns">
              <TimeColumn
                label={`${props.label}小时`}
                max={24}
                value={draft.getHours()}
                onChange={(value) => setDraftTime('hours', String(value))}
              />
              <TimeColumn
                label={`${props.label}分钟`}
                max={60}
                value={draft.getMinutes()}
                onChange={(value) => setDraftTime('minutes', String(value))}
              />
              <TimeColumn
                label={`${props.label}秒`}
                max={60}
                value={draft.getSeconds()}
                onChange={(value) => setDraftTime('seconds', String(value))}
              />
            </div>
            <div className="draftTime">{formatDateTime(draft)}</div>
            <div className="dateActions">
              <button type="button" onClick={() => setOpen(false)}>取消</button>
              <button className="primaryButton" type="button" onClick={confirm}>确定</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TimeColumn(props: {
  label: string;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="timeColumn" aria-label={props.label}>
      {timeOptions(props.max).map((value) => {
        const number = Number(value);
        return (
          <button
            className={number === props.value ? 'selected' : ''}
            key={value}
            onClick={() => props.onChange(number)}
            type="button"
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

function batchTimeError(startTime: string, endTime: string) {
  if (!isDateTimeText(startTime)) return '开始时间格式不正确';
  if (!isDateTimeText(endTime)) return '结束时间格式不正确';
  if (startTime >= endTime) return '结束时间必须晚于开始时间';
  return '';
}

function clampConcurrency(value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(1, Math.min(5, Math.floor(number)));
}

function isDateTimeText(value: string) {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) && !Number.isNaN(Date.parse(value.replace(' ', 'T')));
}

function parseDateTime(value: string) {
  if (!isDateTimeText(value)) return undefined;
  return new Date(value.replace(' ', 'T'));
}

function formatDateTime(date: Date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function calendarDays(month: Date) {
  const firstDay = startOfMonth(month);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const firstCell = new Date(firstDay);
  firstCell.setDate(firstDay.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstCell);
    day.setDate(firstCell.getDate() + index);
    return day;
  });
}

function sameDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function timeOptions(max: number) {
  return Array.from({ length: max }, (_, index) => pad(index));
}
