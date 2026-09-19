import type { Locator, Page } from 'playwright';
import type { ShopAuthStorage } from '../db/shops';
import { openDoudianShopPage } from './doudianSession';

export const DOUDIAN_SEARCH_AFTER_VIEW_URL = 'https://fxg.jinritemai.com/ffa/mcompass/search';

export type SearchAfterViewDraft = {
  shopId: string;
  keywords: string[];
  sku?: string;
};

type SearchAfterViewProduct = {
  id: string;
  title: string;
};

export type SearchAfterViewResult = {
  submitted: boolean;
  videoId: string;
  sku: string;
  productIds: string[];
  mainProductId: string | null;
};

export function extractSearchAfterViewSku(title: string) {
  return title.match(/(?:^|\s)(\d{6})-\d{1,3}(?:\s|$)/)?.[1] ?? null;
}

export function validateSearchAfterViewKeywords(keywords: string[]) {
  const values = keywords.map((value) => value.trim()).filter(Boolean);
  if (values.length < 1 || values.length > 3) throw new Error('看后搜词需要填写 1 至 3 个');
  return values;
}

export function chooseSearchAfterViewMainProduct(products: SearchAfterViewProduct[]) {
  return products.find((product) => !product.title.includes('国补'))?.id ?? null;
}

export async function submitSearchAfterViewTask(
  profile: ShopAuthStorage,
  draft: SearchAfterViewDraft,
  options: { autoSubmit?: boolean } = {}
): Promise<SearchAfterViewResult> {
  const { page } = await openDoudianShopPage(profile, DOUDIAN_SEARCH_AFTER_VIEW_URL, {
    headless: false,
    newPage: true
  });
  page.setDefaultTimeout(15_000);

  try {
    if (await isDoudianLoginPage(page)) {
      throw new Error('自动化浏览器未登录：请先在店铺浏览器完成登录并保存登录状态');
    }

    const result = await configureSearchAfterViewPage(page, draft);
    if (options.autoSubmit === false) return { ...result, submitted: false };

    await page.getByRole('button', { name: '立即提交', exact: true }).click();
    await page.getByRole('button', { name: '立即提交', exact: true }).waitFor({ state: 'hidden', timeout: 10_000 });
    await page.close();
    return { ...result, submitted: true };
  } catch (caught) {
    throw caught;
  }
}

export async function configureSearchAfterViewPage(
  page: Page,
  input: Pick<SearchAfterViewDraft, 'keywords' | 'sku'>
): Promise<Omit<SearchAfterViewResult, 'submitted'>> {
  const keywords = validateSearchAfterViewKeywords(input.keywords);
  await applySearchAfterViewFilters(page);

  const target = await findTargetVideo(page, input.sku);
  const videoText = await target.innerText();
  const videoId = videoText.match(/ID\s*(\d{10,})/)?.[1];
  const sku = input.sku ?? extractSearchAfterViewSku(videoText);
  if (!videoId || !sku) throw new Error('视频信息缺少视频 ID 或款号');

  await target.getByRole('button', { name: '立即配置', exact: true }).click();
  await page.getByText(/添加承接商品/).last().waitFor({ state: 'visible' });

  const products = await selectSearchAfterViewProducts(page, sku);
  const mainProductId = chooseSearchAfterViewMainProduct(products);
  if (mainProductId) await setMainProduct(page, mainProductId);
  await confirmSelectedProducts(page);
  await fillSearchAfterViewKeywords(page, keywords);

  return {
    videoId,
    sku,
    productIds: products.map((product) => product.id),
    mainProductId
  };
}

async function applySearchAfterViewFilters(page: Page) {
  try {
    await page.getByText('配置状态', { exact: true }).waitFor({ state: 'visible', timeout: 45_000 });
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '');
    const context = body.replace(/\s+/g, ' ').slice(0, 240);
    throw new Error(`看后搜页面未加载：${page.url()}；标题：${await page.title().catch(() => '')}；页面文字：${context}`, { cause: error });
  }
  const pendingFilter = page.locator('div[class*="tagList_"] div[class*="tagItem_"]:visible')
    .filter({ hasText: /^待配置(?:\s|$)/ });
  await pendingFilter.click({ force: true });
  const thirtyDayFilter = page.locator('label.ecom-radio-button-wrapper:visible').filter({ hasText: '近30天' }).last();
  await thirtyDayFilter.click({ force: true });

  const author = page.locator('input#_auto__author_id');
  if (await author.count()) {
    const selected = await author.locator('xpath=../..').textContent();
    if (!selected?.includes('全部自营账号')) {
      await author.locator('xpath=../..').click();
      await selectVisibleFilterOption(page, /^全部自营账号$/);
      await expectFilterValue(author, '全部自营账号');
    }
  }

  const trailer = page.locator('input#_auto__trailer_type');
  if (await trailer.count()) {
    const selected = await trailer.locator('xpath=../..').textContent();
    if (!selected?.includes('全部')) {
      await trailer.locator('xpath=../..').click();
      await selectVisibleFilterOption(page, /^全部$/);
      await expectFilterValue(trailer, '全部');
    }
  }

  await page.getByRole('button', { name: '查询', exact: true }).click();
  await page.getByRole('button', { name: '立即配置', exact: true }).first().waitFor({ state: 'visible' });
}

async function findTargetVideo(page: Page, expectedSku?: string) {
  const candidates: string[] = [];
  for (let pageNumber = 1; pageNumber <= 100; pageNumber += 1) {
    const rows = await page.locator('tr, [role="row"], [class*="table-row"], [class*="TableRow"]').all();
    for (const row of rows) {
      const text = await row.innerText();
      if (!text.includes('待配置')) continue;
      if (!await row.getByRole('button', { name: '立即配置', exact: true }).count()) continue;
      const sku = extractSearchAfterViewSku(text);
      const videoId = text.match(/ID\s*(\d{10,})/)?.[1];
      if (videoId && sku && (!expectedSku || sku === expectedSku || text.includes(expectedSku))) return row;
      candidates.push(text.replace(/\s+/g, ' ').slice(0, 160));
    }
    if (!await goToNextSearchAfterViewPage(page)) break;
  }
  throw new Error(expectedSku
    ? `翻完页面仍没有找到款号 ${expectedSku} 的待配置视频；候选文字：${candidates.slice(0, 8).join(' | ')}`
    : `翻完页面仍没有找到待配置且带款号的视频；候选文字：${candidates.slice(0, 8).join(' | ')}`);
}

async function goToNextSearchAfterViewPage(page: Page) {
  const selectors = [
    'button[aria-label*="下一页"]:visible',
    '[role="button"][aria-label*="下一页"]:visible',
    'button[class*="pagination-next"]:visible',
    '[class*="pagination"] button:visible'
  ];
  for (const selector of selectors) {
    const buttons = await page.locator(selector).all();
    for (const button of buttons) {
      if (!await button.isVisible().catch(() => false)) continue;
      if (await button.isDisabled().catch(() => false)) return false;
      const className = await button.getAttribute('class').catch(() => '') ?? '';
      if (/disabled/i.test(className)) return false;
      const label = `${await button.innerText().catch(() => '')}${await button.getAttribute('aria-label').catch(() => '') ?? ''}`;
      if (!/下一页|›|>|next/i.test(label)) continue;
      await button.click();
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

async function selectVisibleFilterOption(page: Page, pattern: RegExp) {
  const option = page.locator('.ecom-select-item-option:visible').filter({ hasText: pattern }).last();
  await option.waitFor({ state: 'visible' });
  await option.click();
}

async function expectFilterValue(input: Locator, expected: string) {
  const value = await input.locator('xpath=../..').textContent();
  if (!value?.includes(expected)) throw new Error(`筛选条件未生效：期望「${expected}」，实际为「${value?.trim() ?? ''}」`);
}

async function selectSearchAfterViewProducts(page: Page, sku: string) {
  await page.getByText(/添加承接商品/).last().click();
  const search = page.getByPlaceholder('请输入商品ID/商品名称', { exact: true }).last();
  await search.waitFor({ state: 'visible' });
  await search.fill(sku);
  await search.press('Enter');

  const products: SearchAfterViewProduct[] = [];
  const ids = [...new Set((await page.locator('body').innerText()).match(/ID\s*(\d{10,})/g) ?? [])]
    .map((value) => value.replace(/\D/g, ''));
  const controls = await page.locator('input[type="checkbox"], [role="checkbox"], [aria-checked], [class*="checkbox"], [class*="Checkbox"]').all();
  for (const id of ids) {
    for (const control of controls) {
      const container = control.locator('xpath=ancestor::*[contains(., "ID ' + id + '")][1]');
      if (!await container.count()) continue;
      const text = await container.innerText().catch(() => '');
      if (!text.includes(id)) continue;
      await control.check().catch(() => control.click());
      products.push({ id, title: text });
      break;
    }
  }
  if (products.length === 0) {
    const candidateRows = await page.locator('tr, [role="row"], .ecom-mcenter-table-row, [class*="table-row"]')
      .filter({ hasText: /ID\s*\d{10,}/ })
      .all();
    const rowTexts = await Promise.all(candidateRows.slice(0, 4).map(async (row) => {
      const text = (await row.innerText()).replace(/\s+/g, ' ').slice(0, 300);
      const inputs = await row.locator('input[type="checkbox"]').count();
      const roles = await row.locator('[role="checkbox"]').count();
      const aria = await row.locator('[aria-checked]').count();
      const classes = await row.locator('[class*="checkbox"], [class*="Checkbox"]').count();
      return `${text} [input=${inputs},role=${roles},aria=${aria},class=${classes}]`;
    }));
    throw new Error(`商品搜索结果没有可选链接：${sku}；候选行 ${rowTexts.length} 条：${rowTexts.join(' | ')}`);
  }
  return products;
}

async function setMainProduct(page: Page, productId: string) {
  const card = page.getByText(`ID ${productId}`, { exact: true }).last().locator('xpath=../../../../..');
  const button = card.getByRole('button', { name: '设置主推', exact: true });
  if (await button.count()) await button.click();
}

async function confirmSelectedProducts(page: Page) {
  const button = await bottomVisibleButton(page, '确定');
  await button.click();
  await page.getByText(/添加承接商品 1\/5|添加承接商品 2\/5|添加承接商品 3\/5|添加承接商品 4\/5|添加承接商品 5\/5/)
    .waitFor({ state: 'visible' });
}

async function fillSearchAfterViewKeywords(page: Page, keywords: string[]) {
  const input = page.locator('input.ecom-input-tag-input');
  for (const keyword of keywords) {
    await input.fill(keyword);
    await input.press('Enter');
  }
  for (const keyword of keywords) {
    if (!await page.getByText(keyword, { exact: true }).count()) {
      throw new Error(`看后搜词未写入：${keyword}`);
    }
  }
  await page.locator('div.ecom-input-tag').last().click();
}

async function bottomVisibleButton(page: Page, name: string) {
  const buttons = await page.getByRole('button', { name, exact: true }).all();
  let result: Locator | undefined;
  let bottom = -1;
  for (const button of buttons) {
    if (!await button.isVisible().catch(() => false)) continue;
    const box = await button.boundingBox();
    if (box && box.y > bottom) {
      result = button;
      bottom = box.y;
    }
  }
  if (!result) throw new Error(`没有找到可见的${name}按钮`);
  return result;
}

async function isDoudianLoginPage(page: Page) {
  return page.url().includes('/login/') || (await page.title()).includes('登录');
}
