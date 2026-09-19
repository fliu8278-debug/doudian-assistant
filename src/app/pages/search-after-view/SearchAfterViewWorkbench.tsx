import { useMemo, useState } from 'react';
import type { Shop } from '../../../shared/types';

export type SearchAfterViewStatus = '待配置' | '审核中' | '已完成';

type SearchAfterViewRow = {
  id: string;
  title: string;
  sku: string;
  videoId: string;
  publishedAt: string;
  status: SearchAfterViewStatus;
};

type SearchAfterViewProduct = {
  id: string;
  title: string;
  subsidy: boolean;
};

const DEFAULT_KEYWORDS = ['斯凯奇纵云', '斯凯奇速锋', '斯凯奇男鞋'];

const MOCK_ROWS: SearchAfterViewRow[] = [
  {
    id: 'video-211085-45',
    title: '不想穿得太运动选这双卡其套脚鞋搭休闲裤出门简单大方看着挺耐看 #斯凯奇 #斯凯奇鞋子 #一脚蹬鞋',
    sku: '211085-45',
    videoId: '7677860691188911403',
    publishedAt: '2026/08/25',
    status: '待配置'
  },
  {
    id: 'video-232619-12',
    title: '白灰咖绗缝厚底系带鞋通勤配直筒裤清爽利落日常好搭不费心更省心',
    sku: '232619-12',
    videoId: '7683721817562942772',
    publishedAt: '2026/09/10',
    status: '待配置'
  },
  {
    id: 'video-216704-24',
    title: '这双鞋日常通勤散步都省心不用费劲搭出门通勤散步都舒服又省心日',
    sku: '216704-24',
    videoId: '7676308144460533027',
    publishedAt: '2026/08/21',
    status: '审核中'
  },
  {
    id: 'video-216704-1',
    title: '藏青一脚蹬网面鞋白底显干净周末逛街搭卡其短裤轻快自然不费心呀',
    sku: '216704-1',
    videoId: '7683395819537534242',
    publishedAt: '2026/09/09',
    status: '已完成'
  }
];

const MOCK_PRODUCTS: SearchAfterViewProduct[] = [
  { id: '3843562213268914719', title: '【国补】斯凯奇闪穿鞋秋季男子一脚蹬健步鞋厚底老人鞋爸爸鞋211085', subsidy: true },
  { id: '3827780832781795719', title: '斯凯奇男鞋2026夏季闪穿一脚蹬健步鞋透气轻弹网面休闲鞋211085', subsidy: false },
  { id: '3827209481712959517', title: '斯凯奇闪穿鞋夏季男子一脚蹬网面轻便透气健步鞋厚底休闲鞋211085', subsidy: false },
  { id: '3796235244974244275', title: '【透气网鞋】斯凯奇闪穿鞋夏季男子一脚蹬健步鞋厚底休闲鞋211085', subsidy: false }
];

export function SearchAfterViewWorkbench({ currentShop, shops = [] }: { currentShop?: Shop; shops?: Shop[] }) {
  const [rows, setRows] = useState(MOCK_ROWS);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState(MOCK_PRODUCTS.map((product) => product.id));
  const [selectedShopId, setSelectedShopId] = useState(currentShop?.id ?? '');
  const [defaultKeywords, setDefaultKeywords] = useState(DEFAULT_KEYWORDS);
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [keywordDraft, setKeywordDraft] = useState('');
  const [defaultKeywordDraft, setDefaultKeywordDraft] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [notice, setNotice] = useState('');

  const availableShops = shops.length > 0 ? shops : currentShop ? [currentShop] : [];
  const selectedShop = availableShops.find((shop) => shop.id === selectedShopId) ?? currentShop;
  const activeRow = rows.find((row) => row.id === activeRowId) ?? null;
  const visibleProducts = useMemo(
    () => MOCK_PRODUCTS.filter((product) => product.title.includes(productSearch.trim())),
    [productSearch]
  );
  function openConfig(row: SearchAfterViewRow) {
    setActiveRowId(row.id);
    setSelectedProductIds(MOCK_PRODUCTS.map((product) => product.id));
    setKeywords(defaultKeywords);
    setKeywordDraft('');
    setProductSearch('');
  }

  function addDefaultKeyword() {
    const value = defaultKeywordDraft.trim();
    if (!value || defaultKeywords.length >= 3 || defaultKeywords.includes(value)) return;
    setDefaultKeywords((current) => [...current, value]);
    setDefaultKeywordDraft('');
  }

  function toggleProduct(productId: string) {
    setSelectedProductIds((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
  }

  function addKeyword() {
    const value = keywordDraft.trim();
    if (!value || keywords.length >= 3 || keywords.includes(value)) return;
    setKeywords((current) => [...current, value]);
    setKeywordDraft('');
  }

  function submitConfig() {
    if (!activeRow) return;
    setRows((current) => current.map((row) => row.id === activeRow.id ? { ...row, status: '审核中' } : row));
    setActiveRowId(null);
    setNotice(`${activeRow.sku} 已提交，状态为审核中`);
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
          <div className="searchAfterViewMainHeader"><div><h2>看后搜配置</h2><p>按筛选条件顺序处理视频，不需要在页面逐条选择。</p></div><button className="primaryButton" type="button" onClick={() => openConfig(rows.find((row) => row.status === '待配置') ?? rows[0])}>开始配置</button></div>
          <section className="searchAfterViewPreset">
            <div><strong>默认看后搜词</strong><span>可自定义填写，打开配置时自动带入。</span><small>承接商品示例：4 个商品，包含 1 个国补链接；默认选择非国补商品作为主推品。</small></div>
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

      {activeRow ? <div className="searchAfterViewBackdrop" role="presentation" onMouseDown={() => setActiveRowId(null)}>
        <aside className="searchAfterViewDrawer" role="dialog" aria-label="设置看后搜" onMouseDown={(event) => event.stopPropagation()}>
          <div className="searchAfterViewDrawerHeader"><div><span>设置看后搜</span><h2>{activeRow.sku}</h2></div><button className="iconButton" type="button" onClick={() => setActiveRowId(null)} aria-label="关闭">×</button></div>
          <div className="searchAfterViewDrawerBody">
            <div className="searchAfterViewVideoSummary"><strong>{activeRow.title}</strong><span>视频 ID {activeRow.videoId} · {activeRow.publishedAt}</span></div>
            <section className="searchAfterViewDrawerSection"><div className="searchAfterViewSectionTitle"><h3>设置搜后承接商品</h3><span>{selectedProductIds.length}/5 已选</span></div><div className="searchAfterViewProductTools"><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="搜索商品 ID/名称" /><button className="secondaryButton" type="button" onClick={() => setSelectedProductIds(MOCK_PRODUCTS.map((product) => product.id))}>全选</button></div><div className="searchAfterViewProductList">{visibleProducts.map((product, index) => <label className="searchAfterViewProduct" key={product.id}><input checked={selectedProductIds.includes(product.id)} onChange={() => toggleProduct(product.id)} type="checkbox" /><span><strong>{product.title}</strong><small>ID {product.id}</small></span>{product.subsidy ? <em>国补</em> : index === 1 ? <em className="mainProductBadge">主推品</em> : null}</label>)}</div></section>
            <section className="searchAfterViewDrawerSection"><div className="searchAfterViewSectionTitle"><h3>设置看后搜词</h3><span>{keywords.length}/3</span></div><div className="searchAfterViewKeywordTags active">{keywords.map((keyword) => <button type="button" key={keyword} onClick={() => setKeywords((current) => current.filter((item) => item !== keyword))}>{keyword} ×</button>)}</div><div className="searchAfterViewKeywordInput"><input value={keywordDraft} onChange={(event) => setKeywordDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addKeyword(); }} placeholder="请输入看后搜词" /><button className="secondaryButton" type="button" onClick={addKeyword}>添加</button></div><p>填写后点击输入框外区域即可确认标签。</p></section>
          </div>
          <div className="searchAfterViewDrawerFooter"><button className="secondaryButton" type="button" onClick={() => setActiveRowId(null)}>取消</button><button className="primaryButton" type="button" onClick={submitConfig}>立即提交</button></div>
        </aside>
      </div> : null}
    </div>
  );
}
