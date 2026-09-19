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
  await page.getByText('待配置', { exact: true }).first().click();
  await page.locator('label').filter({ hasText: '近30天' }).last().click();

  const author = page.locator('input#_auto__author_id');
  if (await author.count()) {
    const selected = await author.locator('xpath=../..').textContent();
    if (!selected?.includes('全部自营账号')) {
      await author.click();
      await page.locator('.ecom-select-item-option').filter({ hasText: '全部自营账号' }).click();
    }
  }

  const trailer = page.locator('input#_auto__trailer_type');
  if (await trailer.count()) {
    const selected = await trailer.locator('xpath=../..').textContent();
    if (!selected?.includes('全部')) {
      await trailer.click();
      await page.locator('.ecom-select-item-option').filter({ hasText: /^全部$/ }).click();
    }
  }

  await page.getByRole('button', { name: '查询', exact: true }).click();
  await page.getByRole('button', { name: '立即配置', exact: true }).first().waitFor({ state: 'visible' });
}

async function findTargetVideo(page: Page, expectedSku?: string) {
  const rows = await page.locator('tr').filter({ hasText: '待配置' }).all();
  for (const row of rows) {
    if (!await row.getByRole('button', { name: '立即配置', exact: true }).count()) continue;
    const text = await row.innerText();
    const sku = extractSearchAfterViewSku(text);
    if (sku && (!expectedSku || sku === expectedSku)) return row;
  }
  throw new Error(expectedSku
    ? `没有找到款号 ${expectedSku} 的待配置视频`
    : '没有找到待配置且带款号的视频');
}

async function selectSearchAfterViewProducts(page: Page, sku: string) {
  await page.getByText(/添加承接商品/).last().click();
  const search = page.getByPlaceholder('请输入商品ID/商品名称', { exact: true }).last();
  await search.waitFor({ state: 'visible' });
  await search.fill(sku);
  await search.press('Enter');

  const rows = await page.locator('tr').filter({ hasText: sku }).all();
  const products: SearchAfterViewProduct[] = [];
  for (const row of rows) {
    const checkbox = row.getByRole('checkbox').first();
    if (!await checkbox.count()) continue;
    const text = await row.innerText();
    const id = text.match(/ID\s*(\d{10,})/)?.[1];
    if (!id) continue;
    await checkbox.check().catch(() => checkbox.click());
    products.push({ id, title: text });
  }
  if (products.length === 0) throw new Error(`商品搜索结果没有可选链接：${sku}`);
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
