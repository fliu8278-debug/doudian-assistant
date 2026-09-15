import type { ShopSnapshot } from '../shared/types';
import type { ShopAuthStorage } from '../db/shops';
import { DOUDIAN_HOME_URL } from './browser';
import { openDoudianShopPage } from './doudianSession';

export type DoudianShopSnapshotResult = {
  name: string;
  snapshot: ShopSnapshot;
};

export async function readDoudianShopSnapshot(profile: ShopAuthStorage): Promise<DoudianShopSnapshotResult> {
  const { page } = await openDoudianShopPage(profile, DOUDIAN_HOME_URL);
  page.setDefaultTimeout(10_000);

  await page.waitForLoadState('domcontentloaded');
  try {
    await page.getByText('经营数据', { exact: false }).first().waitFor({ state: 'visible', timeout: 20_000 });
  } catch {
    const title = await page.title().catch(() => '');
    throw new Error(`没有读取到抖店首页经营数据，当前页面：${title || '无标题'} ${page.url()}。请确认这个店铺浏览器已登录并进入抖店首页。`);
  }
  const domResult = snapshotFromSections({
    todoTexts: await page.locator('[class*="todoItem"], [class*="item-tNQTq5"]').allTextContents(),
    compassTexts: await page.locator('[class*="compassCard"]').allTextContents(),
    bodyText: await page.locator('body').innerText(),
    rightSideText: await page.locator('[class*="right-side-bar"]').first().textContent().catch(() => null)
  });
  if (domResult.name) return domResult;

  const result = parseDoudianHomeSnapshot(domResult.rawText);
  if (!result.name) throw new Error('没有读取到店铺名称');
  return result;
}

export function parseDoudianHomeSnapshot(text: string): DoudianShopSnapshotResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const compactText = lines.join('');

  return {
    name: findShopName(lines, compactText),
    snapshot: {
      pendingPayment: metric(lines, compactText, '待支付'),
      pendingShipment: metric(lines, compactText, '待发货'),
      abnormalPackage: metric(lines, compactText, '异常包裹'),
      pendingAfterSale: metric(lines, compactText, '待处理售后'),
      serviceTicket: metric(lines, compactText, '服务工单'),
      riskPoint: metric(lines, compactText, '待整改风险点'),
      violation: metric(lines, compactText, '待处理违规'),
      revenueAmount: metric(lines, compactText, '成交金额'),
      orderCount: metric(lines, compactText, '成交订单数'),
      spendAmount: metric(lines, compactText, '支出金额'),
      refundAmount: metric(lines, compactText, '退款金额(支付时间)'),
      shopRank: shopRank(lines, compactText),
      experienceScore: experienceScore(lines, compactText)
    }
  };
}

function snapshotFromSections(input: {
  todoTexts: string[];
  compassTexts: string[];
  bodyText: string;
  rightSideText?: string | null;
}): DoudianShopSnapshotResult & { rawText: string } {
  const snapshot: ShopSnapshot = {};

  const todoMap: Array<[keyof ShopSnapshot, string]> = [
    ['pendingPayment', '待支付'],
    ['pendingShipment', '待发货'],
    ['abnormalPackage', '异常包裹'],
    ['pendingAfterSale', '待处理售后'],
    ['serviceTicket', '服务工单'],
    ['riskPoint', '待整改风险点'],
    ['violation', '待处理违规']
  ];
  const todoItems = input.todoTexts.map(normalizeCompact);
  for (const [key, label] of todoMap) {
    snapshot[key] = readInlineMetric(todoItems, label);
  }

  const compassMap: Array<[keyof ShopSnapshot, string]> = [
    ['revenueAmount', '成交金额'],
    ['orderCount', '成交订单数'],
    ['spendAmount', '支出金额'],
    ['refundAmount', '退款金额(支付时间)']
  ];
  const compassCards = input.compassTexts.map(normalizeCompact);
  for (const [key, label] of compassMap) {
    snapshot[key] = readInlineMetric(compassCards, label);
  }

  const bodyText = normalizeCompact(input.bodyText);
  snapshot.shopRank = bodyText.match(/7日店铺排行第?([\d,]+)名/)?.[1];
  if (snapshot.shopRank) snapshot.shopRank = `第${snapshot.shopRank}名`;

  const rightSideText = normalizeCompact(input.rightSideText);
  const name = rightSideText.match(/^(.+?)(?:添加小二|商家体验分)/)?.[1] ?? '';
  snapshot.experienceScore = rightSideText.match(/商家体验分([\d.]+)分/)?.[1];

  return { name, snapshot, rawText: input.bodyText };
}

function normalizeCompact(value?: string | null) {
  return (value ?? '').replace(/\s+/g, '').trim();
}

function findShopName(lines: string[], compactText: string) {
  const rightSideName = compactText.match(/([\u4e00-\u9fa5A-Za-z0-9（）()·-]{2,80}店)添加小二商家体验分/)?.[1];
  return rightSideName ?? lines.find((line) => line.includes('店') && !line.includes('店铺管理')) ?? '';
}

function metric(lines: string[], compactText: string, label: string) {
  return compactMetric(compactText, label) ?? after(lines, label);
}

function after(lines: string[], label: string) {
  const index = lines.indexOf(label);
  if (index < 0) return undefined;
  return lines[index + 1];
}

function compactMetric(text: string, label: string) {
  const escapedLabel = escapeRegExp(label);
  return text.match(new RegExp(`${escapedLabel}(¥?[\\d,.%-]+|-)(?=[\\u4e00-\\u9fa5（(]|$)`))?.[1];
}

function readInlineMetric(texts: string[], label: string) {
  for (const text of texts) {
    const value = compactMetric(text, label);
    if (value !== undefined) return value;
  }
  return undefined;
}

function experienceScore(lines: string[], compactText: string) {
  return compactText.match(/商家体验分([\d.]+)分/)?.[1] ?? after(lines, '商家体验分');
}

function shopRank(lines: string[], compactText: string) {
  const compactRank = compactText.match(/7日店铺排行第?([\d,]+)名/)?.[1];
  if (compactRank) return `第${compactRank}名`;

  const index = lines.indexOf('7日店铺排行');
  if (index < 0) return undefined;
  const rank = lines.slice(index, index + 8).find((line) => /^[\d,]+$/.test(line));
  return rank ? `第${rank}名` : undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
