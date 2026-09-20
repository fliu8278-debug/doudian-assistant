import { useState } from 'react';
import type { Shop } from '../../../shared/types';
import { startSearchAfterView } from '../../api';

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
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState('');

  const availableShops = shops.length > 0 ? shops : currentShop ? [currentShop] : [];
  const selectedShop = availableShops.find((shop) => shop.id === selectedShopId) ?? currentShop;
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
    setRunning(true);
    setNotice('正在打开已登录店铺浏览器，自动配置下一条待配置视频…');
    try {
      const result = await startSearchAfterView({ shopId, keywords: defaultKeywords });
      setNotice(`${result.sku || '下一条视频'} 已提交，浏览器自动化完成`);
    } catch (caught) {
      setNotice(formatSearchAfterViewError(caught));
    } finally {
      setRunning(false);
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
          <div className="searchAfterViewMainHeader"><div><h2>看后搜配置</h2><p>点击开始后将直接打开已登录浏览器自动配置。</p></div><button className="primaryButton" disabled={running} type="button" onClick={() => void startAutomaticConfig()}>{running ? '浏览器配置中…' : '开始自动配置'}</button></div>
          <section className="searchAfterViewPreset">
            <div><strong>默认看后搜词</strong><span>可自定义填写，启动自动化时自动带入。</span><small>自动选择全部承接商品，国补商品自动保留，再自动选择一个主推品。</small></div>
            <div className="searchAfterViewPresetEditor"><div className="searchAfterViewKeywordTags">{defaultKeywords.map((keyword) => <button type="button" key={keyword} onClick={() => setDefaultKeywords((current) => current.filter((item) => item !== keyword))}>{keyword} ×</button>)}</div><div className="searchAfterViewKeywordInput"><input value={defaultKeywordDraft} onChange={(event) => setDefaultKeywordDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addDefaultKeyword(); }} placeholder="自定义看后搜词" /><button className="secondaryButton" type="button" onClick={addDefaultKeyword}>添加</button></div></div>
          </section>
          <section className="searchAfterViewQueue">
            <div><span className="statusTag active">待配置优先</span><h2>准备配置</h2><p>程序会按顺序处理符合条件的视频。</p></div>
          </section>
        </div>

        <section className="panel runPanel searchAfterViewExecution" aria-live="polite">
          <div className="runPanelHeader"><h2>当前执行</h2><span className="runState ready">未开始</span></div>
          <div className="runFocus"><span>当前款号</span><strong>--</strong><p>开始配置后，可以在这里查看当前处理的款号。</p></div>
          <div className="runProgressBlock"><div className="runProgressMeta"><span>整体进度</span><b>0%</b></div><div className="runProgressTrack" aria-label="整体进度"><i style={{ width: '0%' }} /></div></div>
          <div className="runStats" aria-label="任务进度"><span>已配置 <b>0</b></span><span>可提交 <b>0</b></span><span>错误 <b>0</b></span></div>
          <div className="logBox"><strong>执行记录</strong><div className="logEmpty">暂无执行记录</div></div>
        </section>
      </section>

      {notice ? <div className="toastMessage" role="status">{notice}<button type="button" onClick={() => setNotice('')}>知道了</button></div> : null}

    </div>
  );
}
