import { useEffect, useState } from 'react';
import type { Shop } from '../../../shared/types';
import { getSearchAfterViewTask, pauseSearchAfterViewTask, startSearchAfterView, type SearchAfterViewTask } from '../../api';

export type SearchAfterViewStatus = '待配置' | '审核中' | '已完成';

const DEFAULT_KEYWORDS = ['斯凯奇纵云', '斯凯奇速锋', '斯凯奇男鞋'];

export function formatSearchAfterViewError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.split(/\r?\n/)[0].trim();
  return firstLine || '自动配置失败，请稍后重试';
}


export function SearchAfterViewWorkbench({ currentShop, shops = [] }: { currentShop?: Shop; shops?: Shop[] }) {
  const [selectedShopId, setSelectedShopId] = useState(currentShop?.id ?? '');
  const [defaultKeywords, setDefaultKeywords] = useState(DEFAULT_KEYWORDS);
  const [defaultKeywordDraft, setDefaultKeywordDraft] = useState('');
  const [task, setTask] = useState<SearchAfterViewTask | null>(null);
  const [notice, setNotice] = useState('');

  const availableShops = shops.length > 0 ? shops : currentShop ? [currentShop] : [];
  const selectedShop = availableShops.find((shop) => shop.id === selectedShopId) ?? currentShop;
  const running = task?.status === 'running';
  const taskState = task?.status ?? 'ready';
  const taskLabel = taskState === 'running' ? '执行中' : taskState === 'paused' ? '已暂停' : taskState === 'complete' ? '已完成' : taskState === 'failed' ? '失败' : '未开始';
  const taskClass = taskState === 'paused' ? 'waiting' : taskState === 'complete' ? 'success' : taskState;

  useEffect(() => {
    if (!task || task.status !== 'running') return;
    let active = true;
    const refresh = async () => {
      try {
        const next = await getSearchAfterViewTask(task.id);
        if (active) setTask(next);
      } catch (caught) {
        if (active) setNotice(formatSearchAfterViewError(caught));
      }
    };
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [task?.id, task?.status]);

  function addDefaultKeyword() {
    const value = defaultKeywordDraft.trim();
    if (!value || defaultKeywords.length >= 3 || defaultKeywords.includes(value)) return;
    setDefaultKeywords((current) => [...current, value]);
    setDefaultKeywordDraft('');
  }

  async function startAutomaticConfig() {
    const shopId = selectedShop?.id;
    if (!shopId) {
      setNotice('请先选择店铺');
      return;
    }
    setNotice('正在打开已登录店铺浏览器，将持续配置待配置视频…');
    try {
      const result = await startSearchAfterView({ shopId, keywords: defaultKeywords });
      setTask(result);
      setNotice('自动配置已启动，可随时暂停任务');
    } catch (caught) {
      setNotice(formatSearchAfterViewError(caught));
    }
  }

  async function pauseTask() {
    if (!task || task.status !== 'running') return;
    setNotice('正在立刻暂停当前浏览器操作…');
    try {
      const result = await pauseSearchAfterViewTask(task.id);
      setTask(result);
      setNotice('任务已暂停，当前条未提交');
    } catch (caught) {
      setNotice(formatSearchAfterViewError(caught));
    }
  }

  return (
    <div className="workspacePage searchAfterViewPage">
      <div className="workspaceBreadcrumb">商品 / 看后搜配置</div>
      <header className="workspaceHeader searchAfterViewHeader">
        <div>
          <h1>看后搜配置</h1>
          <p>按视频逐条配置承接商品和看后搜词，流程与店铺浏览器保持一致。</p>
        </div>
        <div className="searchAfterViewHeaderActions">
          <span className="workspaceHint">当前店铺：{selectedShop?.name ?? '未选择店铺'}</span>
          <button className="secondaryButton" type="button" onClick={() => setNotice('列表已刷新')}>刷新列表</button>
        </div>
      </header>

      <section className="workspaceCard searchAfterViewFilters" aria-label="看后搜筛选">
        <label>店铺<select value={selectedShopId || selectedShop?.id || ''} onChange={(event) => setSelectedShopId(event.target.value)}><option value="">请选择店铺</option>{availableShops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select></label>
        <label>配置状态<select defaultValue="待配置"><option>待配置</option><option>审核中</option><option>已完成</option><option>全部</option></select></label>
        <label>指标周期<select defaultValue="近30天"><option>近30天</option><option>近7天</option><option>近1天</option></select></label>
        <label>发布来源<select defaultValue="全部自营账号"><option>全部自营账号</option></select></label>
        <label>是否挂车<select defaultValue="全部"><option>全部</option><option>已挂车</option><option>未挂车</option></select></label>
        <div className="searchAfterViewFilterActions"><button className="primaryButton" type="button">查询</button><button className="secondaryButton" type="button">重置</button></div>
      </section>

      <section className="searchAfterViewWorkspace">
        <div className="workspaceCard searchAfterViewMain">
          <div className="searchAfterViewMainHeader"><div><h2>看后搜配置</h2><p>点击开始后将直接打开已登录浏览器自动配置，并持续处理待配置视频。</p></div><div className="searchAfterViewMainActions"><button className="primaryButton" disabled={running} type="button" onClick={() => void startAutomaticConfig()}>{running ? '浏览器配置中…' : '开始自动配置'}</button><button className="secondaryButton" disabled={!running} type="button" onClick={() => void pauseTask()}>暂停任务</button></div></div>
          <section className="searchAfterViewPreset">
            <div><strong>默认看后搜词</strong><span>可自定义填写，启动自动化时自动带入。</span><small>自动选择全部承接商品，国补商品自动保留，再自动选择一个主推品。</small></div>
            <div className="searchAfterViewPresetEditor"><div className="searchAfterViewKeywordTags">{defaultKeywords.map((keyword) => <button type="button" key={keyword} onClick={() => setDefaultKeywords((current) => current.filter((item) => item !== keyword))}>{keyword} ×</button>)}</div><div className="searchAfterViewKeywordInput"><input value={defaultKeywordDraft} onChange={(event) => setDefaultKeywordDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addDefaultKeyword(); }} placeholder="自定义看后搜词" /><button className="secondaryButton" type="button" onClick={addDefaultKeyword}>添加</button></div></div>
          </section>
          <section className="searchAfterViewQueue">
            <div><span className="statusTag active">待配置优先</span><h2>准备配置</h2><p>程序会按顺序处理符合条件的视频。</p></div>
          </section>
        </div>

        <section className={`panel runPanel run-${taskClass} searchAfterViewExecution`} aria-live="polite">
          <div className="runPanelHeader"><h2>当前执行</h2><span className={`runState ${taskClass}`}>{taskLabel}</span></div>
          <div className="runFocus"><span>当前款号</span><strong>{task?.currentSku ?? '--'}</strong><p>{task?.message ?? '开始配置后，可以在这里查看当前处理的款号。'}</p></div>
          <div className="runProgressBlock"><div className="runProgressMeta"><span>任务状态</span><b>{taskLabel}</b></div><div className="runProgressTrack" aria-label="任务状态"><i style={{ width: running ? '100%' : '0%' }} /></div></div>
          <div className="runStats" aria-label="任务进度"><span>已配置 <b>{task?.configured ?? 0}</b></span><span>状态 <b>{taskLabel}</b></span><span>错误 <b>{task?.errors ?? 0}</b></span></div>
          <div className="logBox"><strong>执行记录</strong><div className="logEmpty">{task?.message ?? '暂无执行记录'}</div></div>
        </section>
      </section>

      {notice ? <div className="toastMessage" role="status">{notice}<button type="button" onClick={() => setNotice('')}>知道了</button></div> : null}

    </div>
  );
}
