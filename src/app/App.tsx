import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import type { CouponBatch, CouponRow, NewcomerGiftBatch, NewcomerGiftRow, Shop } from '../shared/types';
import { normalizeCouponRow, validateCouponBatchTime, validateCouponRow } from '../imports/couponRows';
import { normalizeNewcomerGiftRow, validateNewcomerGiftRow } from '../imports/newcomerGiftRows';
import { createCouponBatch, createNewcomerGiftBatch, createProductCouponBatch, createVideoFrameExtraction, getCouponBatch, getNewcomerGiftBatch, getProductCouponBatch, getShops, getVideoFrameExtraction, stopCouponBatch, stopNewcomerGiftBatch, stopProductCouponBatch } from './api';
import { UpdateDialog } from './components/UpdateDialog';
import { ShopList } from './pages/shops/ShopList';
import { SearchAfterViewWorkbench } from './pages/search-after-view/SearchAfterViewWorkbench';
import { updateActionLabel, useUpdater, type UpdateState } from './updater';
import { runVideoFrameBatch, type VideoFrameBatchTask } from './videoFrameBatch';

type Page =
  | 'shops'
  | 'accountStatus'
  | 'coupon'
  | 'productCoupon'
  | 'nationalSubsidyCoupon'
  | 'newcomerGift'
  | 'productSearch'
  | 'searchAfterView'
  | 'titleCheck'
  | 'videoFrameExtraction'
  | 'tableTemplates'
  | 'executionRecords'
  | 'settings';
export type NavGroupName = 'shops' | 'marketing' | 'products' | 'video';
export type SidebarGroupState = Record<NavGroupName, boolean>;

const SIDEBAR_GROUP_STORAGE_KEY = 'doudian-sidebar-groups';
const DEFAULT_SIDEBAR_GROUPS: SidebarGroupState = { shops: true, marketing: true, products: true, video: true };
const PAGE_GROUPS: Partial<Record<Page, NavGroupName>> = {
  shops: 'shops',
  accountStatus: 'shops',
  coupon: 'marketing',
  productCoupon: 'marketing',
  nationalSubsidyCoupon: 'marketing',
  newcomerGift: 'marketing',
  productSearch: 'products',
  searchAfterView: 'products',
  titleCheck: 'products',
  videoFrameExtraction: 'video'
};

export function ensurePageGroupExpanded(groups: SidebarGroupState, page: Page): SidebarGroupState {
  const group = PAGE_GROUPS[page];
  return group && !groups[group] ? { ...groups, [group]: true } : groups;
}

function readSidebarGroups(): SidebarGroupState {
  if (typeof window === 'undefined') return DEFAULT_SIDEBAR_GROUPS;
  try {
    const stored = JSON.parse(window.localStorage.getItem(SIDEBAR_GROUP_STORAGE_KEY) ?? 'null') as Partial<SidebarGroupState> | null;
    return stored ? { ...DEFAULT_SIDEBAR_GROUPS, ...Object.fromEntries(Object.keys(DEFAULT_SIDEBAR_GROUPS).map((group) => [group, stored[group as NavGroupName] !== false])) } as SidebarGroupState : DEFAULT_SIDEBAR_GROUPS;
  } catch {
    return DEFAULT_SIDEBAR_GROUPS;
  }
}

function writeSidebarGroups(groups: SidebarGroupState) {
  try {
    window.localStorage.setItem(SIDEBAR_GROUP_STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}
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
  const [expandedGroups, setExpandedGroups] = useState<SidebarGroupState>(() => readSidebarGroups());
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingShops, setRefreshingShops] = useState(false);
  const [shopsRefreshedAt, setShopsRefreshedAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const updater = useUpdater();
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
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

  useEffect(() => {
    if (updater.state.justUpdated) setShowUpdateDialog(true);
  }, [updater.state.justUpdated]);

  const currentShop = useMemo(
    () => shops.find((shop) => shop.current) ?? shops[0],
    [shops]
  );
  const updateAction = () => {
    if (updater.state.phase === 'ready') {
      void updater.restart();
      return;
    }
    setShowUpdateDialog(true);
    if (updater.state.phase === 'idle' || updater.state.phase === 'not-available' || updater.state.phase === 'error') {
      void updater.check();
    }
  };
  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    setExpandedGroups((previous) => {
      const next = ensurePageGroupExpanded(previous, nextPage);
      if (next !== previous) writeSidebarGroups(next);
      return next;
    });
  };
  const toggleGroup = (group: NavGroupName) => {
    setExpandedGroups((previous) => {
      const next = { ...previous, [group]: !previous[group] };
      writeSidebarGroups(next);
      return next;
    });
  };

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

        <button className="sidebarUpdateAction" disabled={updater.state.phase === 'checking' || updater.state.phase === 'downloading'} onClick={updateAction} type="button">
          <NavIcon name="refresh" /><span>软件更新</span><b>{updateActionLabel(updater.state)}</b>
        </button>

        <nav className="sidebarNav" aria-label="主导航">
          <SidebarNavGroup expanded={expandedGroups.shops} group="shops" label="店铺" onToggle={toggleGroup}>
            <button className={navClass(page === 'shops', 'sidebarNavItem sidebarNavChild')} onClick={() => navigate('shops')} type="button"><NavIcon name="shop" />店铺列表</button>
            <button className={navClass(page === 'accountStatus', 'sidebarNavItem sidebarNavChild')} onClick={() => navigate('accountStatus')} type="button"><NavIcon name="account" />账号状态</button>
          </SidebarNavGroup>
          <SidebarNavGroup expanded={expandedGroups.marketing} group="marketing" label="营销" onToggle={toggleGroup}>
            <button className={navClass(page === 'coupon', 'sidebarNavItem sidebarNavChild')} onClick={() => navigate('coupon')} type="button"><NavIcon name="fans" />涨粉券</button>
            <button className={navClass(page === 'productCoupon', 'sidebarNavItem sidebarNavChild')} onClick={() => navigate('productCoupon')} type="button"><NavIcon name="tag" />商品优惠券</button>
            <button className={navClass(page === 'nationalSubsidyCoupon', 'sidebarNavItem sidebarNavChild')} onClick={() => navigate('nationalSubsidyCoupon')} type="button"><NavIcon name="subsidy" />国补优惠券</button>
            <button className={navClass(page === 'newcomerGift', 'sidebarNavItem sidebarNavChild')} onClick={() => navigate('newcomerGift')} type="button"><NavIcon name="gift" />新人礼金</button>
          </SidebarNavGroup>
          <SidebarNavGroup expanded={expandedGroups.products} group="products" label="商品" onToggle={toggleGroup}>
            <button className={navClass(page === 'productSearch', 'sidebarNavItem sidebarNavChild')} onClick={() => navigate('productSearch')} type="button"><NavIcon name="search" />商品搜索</button>
            <button className={navClass(page === 'searchAfterView', 'sidebarNavItem sidebarNavChild')} onClick={() => navigate('searchAfterView')} type="button"><NavIcon name="searchAfterView" />看后搜配置</button>
            <button className={navClass(page === 'titleCheck', 'sidebarNavItem sidebarNavChild')} onClick={() => navigate('titleCheck')} type="button"><NavIcon name="list" />标题检查</button>
          </SidebarNavGroup>
          <SidebarNavGroup expanded={expandedGroups.video} group="video" label="视频" onToggle={toggleGroup}>
            <button className={navClass(page === 'videoFrameExtraction', 'sidebarNavItem sidebarNavChild')} onClick={() => navigate('videoFrameExtraction')} type="button"><NavIcon name="video" />视频抽帧</button>
          </SidebarNavGroup>
        </nav>

        <div className="sidebarFooter">
          <button className={navClass(page === 'tableTemplates', 'sidebarNavItem')} onClick={() => navigate('tableTemplates')} type="button"><NavIcon name="table" />表格模板</button>
          <button className={navClass(page === 'executionRecords', 'sidebarNavItem')} onClick={() => navigate('executionRecords')} type="button"><NavIcon name="history" />执行记录</button>
          <button className={navClass(page === 'settings', 'sidebarNavItem')} onClick={() => navigate('settings')} type="button"><NavIcon name="tuning" />设置</button>
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
        ) : page === 'productCoupon' ? (
          <ProductCouponWorkbench currentShop={currentShop} shops={shops} />
        ) : page === 'nationalSubsidyCoupon' ? (
          <NationalSubsidyCouponWorkbench currentShop={currentShop} shops={shops} />
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
        ) : page === 'searchAfterView' ? (
          <SearchAfterViewWorkbench currentShop={currentShop} shops={shops} />
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
          <SettingsWorkbench onCheck={updateAction} onSetBackground={(enabled) => void updater.setBackground(enabled)} state={updater.state} />
        ) : (
          <CouponWorkbench currentShop={currentShop} shops={shops} />
        )}
      </main>
      {showUpdateDialog ? <div className="updateDialogBackdrop" onMouseDown={() => setShowUpdateDialog(false)}><div onMouseDown={(event) => event.stopPropagation()}><UpdateDialog onCancelDownload={() => void updater.cancelDownload()} onCheck={() => void updater.check()} onClose={() => setShowUpdateDialog(false)} onDownload={() => void updater.download()} onOpenRelease={() => void updater.openRelease()} onRestart={() => void updater.restart()} onSkip={() => { void updater.skip(); setShowUpdateDialog(false); }} state={updater.state} /></div></div> : null}
      {updater.state.phase === 'ready' ? <div className="updateReadyToast"><span>新版本已下载完成</span><button onClick={() => void updater.restart()} type="button">重启更新</button></div> : null}
    </div>
  );
}

function SettingsWorkbench({ state, onCheck, onSetBackground }: { state: UpdateState; onCheck(): void; onSetBackground(enabled: boolean): void }) {
  return (
    <div className="workspacePage settingsWorkspace">
      <div className="workspaceBreadcrumb">设置</div>
      <header className="workspaceHeader"><div><h1>设置</h1><p>管理本地工具与软件更新。</p></div></header>
      <section className="workspaceCard updateCard" aria-label="软件更新">
        <div><span>软件更新</span><h2>当前版本 v{state.currentVersion}</h2><p>{state.version ? `发现新版本 v${state.version}` : '检查新版本并在下载完成后由你决定是否重启安装。'}</p></div>
        <button className="primaryButton" onClick={onCheck} type="button">{updateActionLabel(state)}</button>
        <label><input checked={Boolean(state.backgroundEnabled)} onChange={(event) => onSetBackground(event.target.checked)} type="checkbox" />后台自动下载更新</label>
      </section>
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

export function VideoFrameRateWorkbench() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const requestVersionRef = useRef(0);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [frameDropMode, setFrameDropMode] = useState<'random' | 'interval'>('random');
  const [frameDropValue, setFrameDropValue] = useState(1);
  const [tasks, setTasks] = useState<VideoFrameBatchTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTaskKey, setSelectedTaskKey] = useState('');

  useEffect(() => () => {
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
  }, []);

  function chooseVideos(files: FileList | null) {
    if (!files?.length) return;
    requestVersionRef.current += 1;
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    const added = Array.from(files);
    setSourceFiles((current) => [...current, ...added.filter((file) => !current.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified))]);
    setTasks([]);
    setSelectedTaskKey('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function startProcessing() {
    if (!sourceFiles.length) return;
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    setIsProcessing(true);
    await runVideoFrameBatch(sourceFiles, { mode: frameDropMode, value: frameDropValue }, {
      create: createVideoFrameExtraction,
      get: getVideoFrameExtraction,
      onUpdate: (nextTasks) => {
        if (requestVersion === requestVersionRef.current) setTasks(nextTasks);
      },
      pause: () => new Promise((resolve) => {
        pollTimerRef.current = window.setTimeout(resolve, 1000);
      }),
      shouldStop: () => requestVersion !== requestVersionRef.current
    });
    if (requestVersion === requestVersionRef.current) setIsProcessing(false);
  }

  function removeFile(file: File) {
    if (isProcessing) return;
    setSourceFiles((current) => current.filter((item) => item !== file));
    setTasks([]);
    setSelectedTaskKey('');
  }

  function downloadAll() {
    tasks.filter((task) => task.status === 'complete' && task.job?.downloadUrl).forEach((task) => {
      const link = document.createElement('a');
      link.href = task.job!.downloadUrl!;
      link.download = task.job!.outputName || `${task.file.name}.mp4`;
      link.click();
    });
  }

  const processingTask = tasks.find((task) => task.status === 'processing');
  const previewTask = resolveVideoFramePreviewTask(tasks, selectedTaskKey);
  const previewTaskKey = previewTask ? videoFrameTaskKey(previewTask.file) : '';
  const taskByKey = new Map(tasks.map((task) => [videoFrameTaskKey(task.file), task]));
  const completeTasks = tasks.filter((task) => task.status === 'complete');
  const progress = sourceFiles.length ? Math.round(tasks.reduce((sum, task) => sum + (task.status === 'complete' || task.status === 'failed' ? 100 : task.job?.progress ?? 0), 0) / sourceFiles.length) : 0;
  const currentProgress = processingTask?.job?.progress ?? 0;
  const status = processingTask
    ? `正在处理第 ${tasks.indexOf(processingTask) + 1} 条视频：${currentProgress < 5 ? '上传中' : '重新编码中'}`
    : completeTasks.length === sourceFiles.length && sourceFiles.length > 0 ? '全部处理完成'
      : tasks.some((task) => task.status === 'failed') ? '部分视频处理失败，其余任务已继续执行'
        : '等待开始处理';
  const settingLabel = frameDropMode === 'random' ? `随机删除 ${frameDropValue} 帧` : `每隔 ${frameDropValue} 秒删除 1 帧`;

  return (
    <div className="videoFramePage">
      <div className="pageHeader">
        <div>
          <h1>视频抽帧</h1>
          <p>随机或按间隔删除稀疏画面帧，保留原声与原视频时间线。</p>
        </div>
      </div>

      <section className="videoFrameGrid" aria-label="视频抽帧工作区">
        <section className="workspaceCard videoFramePanel videoFrameSourcePanel videoFrameSourceCard" aria-labelledby="video-source-title">
          <h2 id="video-source-title">上传与处理</h2>
          <label className="videoFrameUpload">
            <strong>批量上传 MP4 视频</strong>
            <span>点击选择文件，可一次添加多个素材</span>
            <input ref={fileInputRef} accept="video/mp4" className="hiddenInput" multiple onChange={(event) => chooseVideos(event.target.files)} type="file" />
          </label>

          {sourceFiles.length ? <section className="videoFrameQueue" aria-label="已添加素材">
            <header><strong>已添加素材</strong><span>{sourceFiles.length} 个</span></header>
            <div className="videoFrameQueueRows">
              {sourceFiles.map((file) => {
                const fileKey = videoFrameTaskKey(file);
                const task = taskByKey.get(fileKey);
                const rowStatus = task?.status ?? 'queued';
                const canPreview = rowStatus === 'complete';
                const selected = canPreview && previewTaskKey === fileKey;
                const statusLabel = rowStatus === 'queued' ? '等待处理' : rowStatus === 'processing' ? '处理中' : rowStatus === 'complete' ? '已完成' : '处理失败';
                const queueProgress = resolveVideoFrameQueueProgress(task);
                return <div className={`videoFrameQueueRow ${rowStatus}${selected ? ' selected' : ''}`} key={fileKey}>
                  <button
                    aria-label={canPreview ? `查看 ${file.name} 的处理结果` : `${file.name} ${statusLabel} ${queueProgress.label}`}
                    aria-pressed={canPreview ? selected : undefined}
                    className="videoFrameQueuePreviewButton"
                    disabled={!canPreview}
                    onClick={() => setSelectedTaskKey(fileKey)}
                    type="button"
                  >
                    <span className="videoFrameFileIcon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h6l4 4v11.5a2.5 2.5 0 0 1-2.5 2.5h-7.5A2.5 2.5 0 0 1 5 18.5v-13Z" stroke="currentColor" strokeWidth="1.8"/><path d="M13.5 3v4h4M9 15.5l2-2 2 1.5 2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                    <span><strong>{file.name}</strong><small>{canPreview ? '点击查看处理结果' : formatFileSize(file.size)}</small></span>
                    <span className="videoFrameQueueProgress" title={statusLabel}>
                      <i aria-hidden="true" className="videoFrameQueueRing" style={{ '--progress': `${queueProgress.value}%` } as CSSProperties} />
                      <small>{queueProgress.label}</small>
                    </span>
                  </button>
                  <button aria-label={`移除 ${file.name}`} className="videoFrameRemoveButton" disabled={isProcessing} onClick={() => removeFile(file)} type="button"><svg viewBox="0 0 24 24" fill="none"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button>
                </div>;
              })}
            </div>
          </section> : null}

          <div className="videoFrameSettings">
            <h3>抽帧设置</h3>
            <div className="videoFrameModePicker" aria-label="抽帧方式">
              <button className={frameDropMode === 'random' ? 'active' : ''} onClick={() => setFrameDropMode('random')} type="button">随机抽帧</button>
              <button className={frameDropMode === 'interval' ? 'active' : ''} onClick={() => setFrameDropMode('interval')} type="button">间隔抽帧</button>
            </div>
            <label className="videoFrameFpsField">
              <span>{frameDropMode === 'random' ? '随机删除帧数' : '间隔秒数'}</span>
              <input
                aria-label={frameDropMode === 'random' ? '随机删除帧数' : '间隔秒数'}
                max={frameDropMode === 'random' ? 100 : 60}
                min={1}
                onChange={(event) => setFrameDropValue(Math.max(1, Math.min(frameDropMode === 'random' ? 100 : 60, Number(event.target.value) || 1)))}
                type="number"
                value={frameDropValue}
              />
              <b>{frameDropMode === 'random' ? '帧' : '秒'}</b>
            </label>
            <div className="videoFrameOutputSelect">输出：MP4 · 保留原声</div>
            <p>仅删除稀疏画面帧，播放速度与时长保持不变</p>
            <button className="primaryButton videoFrameStartButton" disabled={!sourceFiles.length || isProcessing} onClick={() => void startProcessing()} type="button">
              {isProcessing ? '批量处理中…' : '开始批量处理'}
            </button>
          </div>
          <footer className="videoFrameSourceStatus">本次将处理 <b>{sourceFiles.length}</b> 个视频素材</footer>
        </section>

        <section className="workspaceCard videoFramePanel videoFrameOutputPanel videoFrameOutputCard" aria-labelledby="video-output-title">
          <header className="videoFramePanelHeader">
            <h2 id="video-output-title">批量处理结果</h2>
            <button className="videoFrameDownloadButton" disabled={!completeTasks.length} onClick={downloadAll} type="button">下载全部视频</button>
          </header>
          <div className="videoFramePreview videoFrameOutputPreview">
            <video className="videoFramePlayer" controls src={previewTask?.status === 'complete' ? previewTask.job?.previewUrl : undefined} />
            {previewTask ? <span>{previewTask.file.name}<small>{previewTask.status === 'complete' ? selectedTaskKey && previewTaskKey === selectedTaskKey ? '左侧选中的处理结果，可直接预览' : '最近完成的视频，可直接预览' : '处理完成后可在这里预览输出视频'}</small></span> : <span>处理完成后，新视频将在这里预览</span>}
          </div>

          <section className="videoFrameProgress" aria-live="polite" aria-label="处理进度">
            <div className="videoFrameProgressTitle"><strong>整体处理进度</strong><b>{progress}%</b></div>
            <div className="videoFrameProgressTrack"><i style={{ width: `${progress}%` }} /></div>
            <p>{status}</p>
            <div className="videoFrameStages">
              {['上传素材', '重新编码', '生成 MP4'].map((stage, index) => {
                const active = currentProgress >= [1, 5, 100][index];
                return <span className={active ? 'active' : ''} key={stage}>{stage}</span>;
              })}
            </div>
          </section>

          <section className="videoFrameTaskList" aria-label="处理任务">
            <h3>处理任务</h3>
            {tasks.length ? tasks.map((task) => <div className={`videoFrameTaskRow ${task.status}`} key={`${task.file.name}-${task.file.lastModified}-${task.file.size}`}>
              <span><strong>{task.file.name}</strong><small>{settingLabel} · 原声保留</small></span>
              <em><i />{task.status === 'queued' ? '等待处理' : task.status === 'processing' ? '处理中' : task.status === 'complete' ? '已完成' : '处理失败'}</em>
              {task.status === 'complete' && task.job?.downloadUrl ? <a download={task.job.outputName || '处理后视频.mp4'} href={task.job.downloadUrl}>下载</a> : <b>{task.status === 'failed' ? task.error : `${task.job?.progress ?? 0}%`}</b>}
            </div>) : <p className="videoFrameTaskEmpty">添加视频后，处理任务会显示在这里。</p>}
          </section>
          <footer className="videoFrameStatus">状态：{status}</footer>
        </section>
      </section>
    </div>
  );
}

export function videoFrameTaskKey(file: Pick<File, 'name' | 'lastModified' | 'size'>) {
  return `${file.name}-${file.lastModified}-${file.size}`;
}

export function resolveVideoFramePreviewTask(tasks: VideoFrameBatchTask[], selectedTaskKey: string) {
  return tasks.find((task) => task.status === 'complete' && videoFrameTaskKey(task.file) === selectedTaskKey)
    ?? [...tasks].reverse().find((task) => task.status === 'complete')
    ?? tasks.find((task) => task.status === 'processing');
}

export function resolveVideoFrameQueueProgress(task?: VideoFrameBatchTask) {
  if (!task) return { label: '0%', value: 0 };
  if (task.status === 'complete') return { label: '100%', value: 100 };
  if (task.status === 'failed') return { label: '失败', value: 100 };
  const value = Math.max(0, Math.min(100, Math.round(task.job?.progress ?? 0)));
  return { label: `${value}%`, value };
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function navClass(active: boolean, base = 'navItem') {
  return active ? `${base} active` : base;
}

function SidebarNavGroup({ group, label, expanded, onToggle, children }: { group: NavGroupName; label: string; expanded: boolean; onToggle(group: NavGroupName): void; children: ReactNode }) {
  return (
    <div className="sidebarNavGroup">
      <button aria-controls={`sidebar-group-${group}`} aria-expanded={expanded} className="sidebarNavGroupToggle" data-group={group} onClick={() => onToggle(group)} type="button">
        <span className="sidebarNavLabel">{label}</span>
        <svg aria-hidden="true" className="sidebarNavChevron" fill="none" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
      </button>
      <div className="sidebarNavChildren" hidden={!expanded} id={`sidebar-group-${group}`}>{children}</div>
    </div>
  );
}

type NavIconName = 'account' | 'coupon' | 'fans' | 'gift' | 'history' | 'list' | 'refresh' | 'search' | 'searchAfterView' | 'shop' | 'subsidy' | 'table' | 'tag' | 'tuning' | 'video';

function NavIcon({ name }: { name: NavIconName }) {
  const paths: Record<NavIconName, string[]> = {
    account: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4.5 20a7.5 7.5 0 0 1 15 0'],
    coupon: ['M4 8.5A2.5 2.5 0 0 0 6.5 6H18v4a2 2 0 1 1 0 4v4H6.5A2.5 2.5 0 0 0 4 15.5Z', 'M10 6v12'],
    fans: ['M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M3.5 19a5.5 5.5 0 0 1 11 0', 'M16 8a2.5 2.5 0 1 0 0-5', 'M16 13.5a4.5 4.5 0 0 1 4.5 4.5'],
    gift: ['M5 10h14v10H5z', 'M3.5 7.5h17v3h-17z', 'M12 7.5V20', 'M12 7.5S8 7.5 8 5.25C8 3.5 10.4 4 12 7.5Zm0 0s4 0 4-2.25C16 3.5 13.6 4 12 7.5Z'],
    history: ['M4 12a8 8 0 1 0 2.35-5.65L4 8.7', 'M4 4v4.7h4.7', 'M12 7.5V12l3 2'],
    list: ['M8 6h11', 'M8 12h11', 'M8 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'],
    refresh: ['M19 8a7 7 0 1 0 1 5', 'M19 4v4h-4'],
    search: ['m20 20-4.5-4.5', 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z'],
    searchAfterView: ['M4 5h16v14H4z', 'm9 9 6 3-6 3Z'],
    shop: ['M4 10V6l2-3h12l2 3v4', 'M5 10h14v10H5z', 'M9 20v-6h6v6', 'M4 6h16'],
    subsidy: ['M12 3l7 3v5c0 4-3 7-7 10-4-3-7-6-7-10V6l7-3Z', 'M9 12h6', 'M12 9v6'],
    table: ['M4 5h16v14H4z', 'M4 10h16', 'M10 5v14'],
    tag: ['M4 5h8l8 7-8 7H4z', 'M8 9h.01'],
    tuning: ['M4 6h16', 'M4 12h16', 'M4 18h16', 'M9 4v4', 'M15 10v4', 'M11 16v4'],
    video: ['M4 6h11v12H4z', 'm15 10 5-3v10l-5-3']
  };

  return <svg aria-hidden="true" className="sidebarNavIcon" data-icon={name} fill="none" viewBox="0 0 24 24">{paths[name].map((path) => <path d={path} key={path} />)}</svg>;
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
  const runDone = batchCounts ? batchCounts.success + batchCounts.failed + batchCounts.skipped + batchCounts.waiting_confirm : 0;
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
    <div className="workspacePage marketingWorkspace">
      <div className="workspaceBreadcrumb">营销 / 建立新人礼金</div>
      <div className="pageHeader workspaceHeader">
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
    </div>
  );
}

export function CouponWorkbench({ currentShop, shops, kind = 'fan' }: { currentShop?: Shop; shops: Shop[]; kind?: 'fan' | 'product' | 'nationalSubsidy' }) {
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
  const runDone = batchCounts ? batchCounts.success + batchCounts.failed + batchCounts.skipped + batchCounts.waiting_confirm : 0;
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
      setActiveBatch(kind !== 'fan' ? await getProductCouponBatch(activeBatch.id) : await getCouponBatch(activeBatch.id));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeBatch]);

  function downloadTemplate() {
    const productKind = kind !== 'fan';
    downloadWorkbook(kind === 'nationalSubsidy' ? '国补优惠券导入模板.xlsx' : productKind ? '商品优惠券导入模板.xlsx' : '涨粉券导入模板.xlsx', productKind
      ? [['款号', '优惠券名称', '满减门槛', '减免金额'], ['216704', '216704-商品券', '300', '5']]
      : [['款号', '满减门槛', '减免金额'], ['216704', '300', '5']]);
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
      const batch = await (kind !== 'fan' ? createProductCouponBatch : createCouponBatch)({
        shopId: selectedShop.id,
        fileName: fileName || '手动导入',
        rows: validRows,
        concurrency,
        ...(kind === 'nationalSubsidy' ? { selectionMode: 'selfOperated' as const } : {})
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
       setActiveBatch(kind !== 'fan' ? await stopProductCouponBatch(activeBatch.id) : await stopCouponBatch(activeBatch.id));
      setRunMessage('已发送停止指令，未开始的建券任务已停止。');
    } catch (caught) {
      setRunMessage(caught instanceof Error ? caught.message : '停止任务失败');
    }
  }

  return (
    <div className="workspacePage marketingWorkspace">
      <div className="workspaceBreadcrumb">营销 / {kind === 'nationalSubsidy' ? '国补优惠券' : kind === 'product' ? '商品优惠券' : '涨粉券'}</div>
      <div className="pageHeader workspaceHeader">
        <div>
            <h1>{kind === 'nationalSubsidy' ? '国补优惠券建立' : kind === 'product' ? '商品优惠券建立' : '涨粉券建立'}</h1>
            <p>先设置本批领取时间，再导入款号{kind !== 'fan' ? '、优惠券名称' : ''}和满减金额。</p>
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
         本批店铺：{selectedShop?.name ?? '未选择'}。{kind === 'nationalSubsidy' ? '只选择自营品，自动跳过区间价商品；有效天数、续期、发放量、限领和指定商品范围按固定规则处理。' : kind !== 'fan' ? '有效天数、续期、发放量、限领和指定商品范围按固定规则处理。' : '涨粉账户、有效天数、续期、发放量、限领和商品范围按固定规则处理。'}
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
              <span>模板只需要填：款号、满减门槛、减免金额{kind !== 'fan' ? '；优惠券名称（可选）' : ''}。</span>
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
    </div>
  );
}

export function ProductCouponWorkbench({ currentShop, shops }: { currentShop?: Shop; shops: Shop[] }) {
  return <CouponWorkbench currentShop={currentShop} kind="product" shops={shops} />;
}

export function NationalSubsidyCouponWorkbench({ currentShop, shops }: { currentShop?: Shop; shops: Shop[] }) {
  return <CouponWorkbench currentShop={currentShop} kind="nationalSubsidy" shops={shops} />;
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
    skipped: 0,
    success: 0,
    failed: 0
  });
}

function taskStatusText(status?: string) {
  if (status === 'running') return '执行中';
  if (status === 'waiting_confirm') return '待确认';
  if (status === 'skipped') return '已跳过';
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
