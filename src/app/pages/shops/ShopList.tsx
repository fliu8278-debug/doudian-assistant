import { useEffect, useRef, useState } from 'react';
import type { NewShop, Shop, ShopStatus } from '../../../shared/types';
import { addShop, openShopLogin, saveShopLogin, setCurrentShop, setShopStatus, syncShop } from '../../api';

type Props = {
  shops: Shop[];
  loading: boolean;
  onChanged: () => Promise<void>;
  refreshing: boolean;
  refreshedAt: string | null;
};

const statusText: Record<ShopStatus, string> = {
  active: '已登录',
  need_login: '需扫码',
  expired: '已过期'
};

const statusHint: Record<ShopStatus, string> = {
  active: '可以执行工具',
  need_login: '等待扫码绑定',
  expired: '需要重新验证'
};

export function ShopList({ shops, loading, onChanged, refreshing, refreshedAt }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [expandedShopId, setExpandedShopId] = useState<string | null>(null);
  const [form, setForm] = useState<NewShop>({
    name: '',
    remark: '',
    officialAccountName: '店铺官方号'
  });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await addShop(form);
      setForm({ name: '', remark: '', officialAccountName: '店铺官方号' });
      await onChanged();
      setShowAdd(false);
      setMessage('店铺已添加，下一步打开后台扫码登录。');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '添加失败');
    } finally {
      setSaving(false);
    }
  }

  async function update(action: () => Promise<unknown>) {
    setMessage('');
    try {
      await action();
      await onChanged();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : '操作失败');
    }
  }

  async function openLogin(shop: Shop) {
    await update(async () => {
      await openShopLogin(shop.id);
      setMessage('已用该店铺的独立登录环境打开抖店，扫码后点“保存登录状态”。');
    });
  }

  async function saveLogin(shop: Shop) {
    await update(async () => {
      const result = await saveShopLogin(shop.id);
      setMessage(`登录状态已保存到该店铺 cookie 文件，共 ${result.count} 条。`);
    });
  }

  function toggleShop(shopId: string) {
    setExpandedShopId((current) => (current === shopId ? null : shopId));
  }

  function onRowKeyDown(event: React.KeyboardEvent, shopId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleShop(shopId);
    }
  }

  const activeCount = shops.filter((shop) => shop.status === 'active').length;
  const abnormalCount = shops.filter((shop) => shop.status !== 'active').length;
  const currentShop = shops.find((shop) => shop.current);

  useEffect(() => {
    if (!currentShop || currentShop.status !== 'active') return;
    void syncFromDoudian(currentShop, false);
    const timer = window.setInterval(() => void syncFromDoudian(currentShop, false), 30_000);
    return () => window.clearInterval(timer);
  }, [currentShop?.id, currentShop?.status]);

  async function syncFromDoudian(shop: Shop, showMessage = true) {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      await syncShop(shop.id);
      await onChanged();
      if (showMessage) setMessage('店铺数据已从抖店后台同步。');
    } catch (caught) {
      if (showMessage) setMessage(caught instanceof Error ? caught.message : '同步失败');
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }

  return (
    <>
      <div className="shopsHero">
        <div>
          <h1>店铺管理</h1>
          <p>扫码绑定后自动保存登录环境，每个店铺占一行。</p>
        </div>
        <div className="heroActions">
          <button disabled={!currentShop || syncing || refreshing} onClick={() => currentShop ? void syncFromDoudian(currentShop) : undefined}>
            {syncing || refreshing ? '同步中' : '立即同步'}
          </button>
          <button className="primaryButton" onClick={() => setShowAdd(true)}>
            扫码绑定店铺
          </button>
        </div>
      </div>

      <section className="shopStatusStrip" aria-label="店铺状态概览">
        <div>
          <span className="liveLabel">
            <i aria-hidden="true" />
            {syncing ? '正在同步抖店' : `已更新 ${refreshedAt ? formatClock(refreshedAt) : '--'}`}
          </span>
          <strong>{currentShop?.name ?? '未绑定'}</strong>
        </div>
        <div>
          <span>店铺总数</span>
          <strong>{shops.length}</strong>
        </div>
        <div>
          <span>已登录</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>需处理</span>
          <strong>{abnormalCount}</strong>
        </div>
      </section>

      <section className="shopRowsPanel">
        <div className="sectionHeader">
          <div>
            <h2>店铺列表</h2>
            <p>{loading ? '正在读取数据库' : `共 ${shops.length} 个店铺`}</p>
          </div>
        </div>

        <div className="shopRowsHeader">
          <span>店铺</span>
          <span>登录状态</span>
          <span>店铺数据</span>
          <span>可用工具</span>
          <span>操作</span>
        </div>

        {shops.length === 0 && !loading ? (
          <button className="emptyShopRow" onClick={() => setShowAdd(true)}>
            <span className="shopAvatar">+</span>
            <strong>还没有绑定店铺</strong>
            <em>扫码登录完成后，店铺会保存在这里并占一行。</em>
            <b>去绑定</b>
          </button>
        ) : null}

        <div className="shopRows">
          {shops.map((shop) => (
            <article
              aria-expanded={expandedShopId === shop.id}
              className={shop.current ? 'shopRow current' : 'shopRow'}
              key={shop.id}
              onClick={() => toggleShop(shop.id)}
              onKeyDown={(event) => onRowKeyDown(event, shop.id)}
              tabIndex={0}
            >
              <div className="shopRowMain">
                <div className="shopIdentity">
                  <div className="shopAvatar">{shop.name.slice(0, 1)}</div>
                  <div>
                    <h3>{shop.name}</h3>
                    <p>{shop.remark || '未填写备注'}</p>
                  </div>
                </div>

                <div className="statusCell">
                  <span className={`statusTag ${shop.status}`}>{statusText[shop.status]}</span>
                  <small>{statusHint[shop.status]}</small>
                </div>

              <div className="dataCell">
                <span>账号：{shop.officialAccountName}</span>
                <span>成交：{shop.snapshot.revenueAmount ?? '未同步'}</span>
                <span>订单：{shop.snapshot.orderCount ?? '未同步'}</span>
              </div>

                <div className="toolCell">
                  <span>优惠券</span>
                  <span>新人礼金</span>
                </div>

                <div className="shopActions" onClick={(event) => event.stopPropagation()}>
                  <button onClick={() => void openLogin(shop)}>
                    打开后台
                  </button>
                  <button onClick={() => void saveLogin(shop)}>
                    保存登录状态
                  </button>
                  <button onClick={() => update(async () => {
                    await setShopStatus(shop.id, 'need_login');
                    await openShopLogin(shop.id);
                  })}>
                    重新扫码
                  </button>
                  <button disabled={shop.current} onClick={() => update(() => setCurrentShop(shop.id))}>
                    {shop.current ? '当前' : '设为当前'}
                  </button>
                  <span className="expandMark">{expandedShopId === shop.id ? '收起' : '展开'}</span>
                </div>
              </div>

              {expandedShopId === shop.id ? (
                <div className="shopDetails">
                  <div>
                    <span>待发货</span>
                    <strong>{shop.snapshot.pendingShipment ?? '未同步'}</strong>
                  </div>
                  <div>
                    <span>待处理售后</span>
                    <strong>{shop.snapshot.pendingAfterSale ?? '未同步'}</strong>
                  </div>
                  <div>
                    <span>成交金额</span>
                    <strong>{shop.snapshot.revenueAmount ?? '未同步'}</strong>
                  </div>
                  <div>
                    <span>成交订单数</span>
                    <strong>{shop.snapshot.orderCount ?? '未同步'}</strong>
                  </div>
                  <div>
                    <span>支出金额</span>
                    <strong>{shop.snapshot.spendAmount ?? '未同步'}</strong>
                  </div>
                  <div>
                    <span>退款金额</span>
                    <strong>{shop.snapshot.refundAmount ?? '未同步'}</strong>
                  </div>
                  <div>
                    <span>体验分</span>
                    <strong>{shop.snapshot.experienceScore ?? '未同步'}</strong>
                  </div>
                  <div>
                    <span>最近同步</span>
                    <strong>{shop.lastSyncedAt ? formatTime(shop.lastSyncedAt) : '未同步'}</strong>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {showAdd ? (
        <div className="modalBackdrop" role="presentation" onMouseDown={() => setShowAdd(false)}>
          <form className="addShopDialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
            <div className="dialogHeader">
              <div>
                <h2>扫码绑定店铺</h2>
                <p>先打开后台扫码，完成后保存这条店铺记录。</p>
              </div>
              <button type="button" onClick={() => setShowAdd(false)}>关闭</button>
            </div>

            <button
              className="loginButton"
              type="button"
              onClick={() => {
                setMessage('先保存店铺，再从店铺列表用独立环境打开后台。');
              }}
            >
              保存后打开抖店登录页
            </button>

            <label>
              店铺名称
              <input
                id="shop-name"
                autoFocus
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="例如：斯凯奇旗舰店"
              />
            </label>

            <label>
              账号名称
              <input
                value={form.officialAccountName}
                onChange={(event) => setForm({ ...form, officialAccountName: event.target.value })}
                placeholder="例如：店铺官方号"
              />
            </label>

            <label>
              备注
              <textarea
                value={form.remark}
                onChange={(event) => setForm({ ...form, remark: event.target.value })}
                placeholder="主店、测试店、授权账号等"
              />
            </label>

            <button className="primaryButton" disabled={saving}>
              {saving ? '保存中' : '保存店铺'}
            </button>

            <div className="safeNote">
              扫码后的登录状态会保存到该店铺自己的 profile 和 cookie 文件，仅供本机自动化使用。
            </div>
          </form>
        </div>
      ) : null}

      {message ? <div className="toastMessage">{message}</div> : null}
    </>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function formatClock(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', { hour12: false });
}
