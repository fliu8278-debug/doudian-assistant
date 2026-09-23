import type { Locator, Page } from 'playwright';
import type { ShopAuthStorage } from '../db/shops';
import { openDoudianShopPage } from './doudianSession';

export const DOUDIAN_SEARCH_AFTER_VIEW_URL = 'https://fxg.jinritemai.com/ffa/mcompass/search/video';

export type SearchAfterViewDraft = {
  shopId: string;
  keywords: string[];
  sku?: string;
  skippedVideoIds?: string[];
};

type SearchAfterViewProduct = {
  id: string;
  title: string;
};

type SearchAfterViewVideoTarget = {
  row: Locator;
  sku: string;
  title: string;
  videoId: string;
};

export type SearchAfterViewResult = {
  submitted: boolean;
  videoId: string;
  sku: string;
  productIds: string[];
  mainProductId: string | null;
};

type SearchAfterViewTaskPage = {
  closing?: Promise<void>;
  onAbort: () => void;
  page: Page;
};

const taskPages = new WeakMap<AbortSignal, SearchAfterViewTaskPage>();
// ponytail: keep one prepared list per automation page so the next item is
// configured in-place instead of re-querying/restarting the list each time.
const preparedSearchAfterViewPages = new WeakSet<Page>();

export class SearchAfterViewTaskAbortedError extends Error {
  constructor() {
    super('看后搜任务已暂停');
    this.name = 'SearchAfterViewTaskAbortedError';
  }
}

export class SearchAfterViewRowError extends Error {
  constructor(readonly videoId: string, message: string) {
    super(message);
    this.name = 'SearchAfterViewRowError';
  }
}

export function isSearchAfterViewTaskAborted(error: unknown) {
  return error instanceof SearchAfterViewTaskAbortedError;
}

export function runSearchAfterViewAbortable<T>(action: () => Promise<T>, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.reject(new SearchAfterViewTaskAbortedError());
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      callback();
    };
    const onAbort = () => settle(() => reject(new SearchAfterViewTaskAbortedError()));
    signal?.addEventListener('abort', onAbort, { once: true });
    action().then(
      (result) => settle(() => resolve(result)),
      (error) => settle(() => reject(error))
    );
  });
}

export function extractSearchAfterViewSku(title: string) {
  return title.match(/(?<!\d)(\d{6})(?:-\d{1,3})?(?!\d)/)?.[1] ?? null;
}

export function resolveSearchAfterViewTitleSku(title: string, expectedSku?: string) {
  const sku = extractSearchAfterViewSku(title);
  return sku && (!expectedSku || sku === expectedSku) ? sku : null;
}

export function isSearchAfterViewDrawerMatch(drawerText: string, videoId: string, videoTitle: string) {
  const drawer = drawerText.replace(/\s+/g, ' ').trim();
  const title = videoTitle.replace(/\s+/g, ' ').trim();
  return drawer.includes(videoId) || (title.length >= 12 && drawer.includes(title.slice(0, 24)));
}

export function isSearchAfterViewVideoRowMatch(rowText: string, videoId: string) {
  return new RegExp(`(?:^|\\s)ID\\s*${videoId}(?:\\s|$)`).test(rowText);
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
  options: { autoSubmit?: boolean; signal?: AbortSignal } = {}
): Promise<SearchAfterViewResult | null> {
  throwIfSearchAfterViewTaskAborted(options.signal);
  const page = await getSearchAfterViewTaskPage(profile, options.signal);
  let closePage = !options.signal;

  try {
    throwIfSearchAfterViewTaskAborted(options.signal);
    if (await isDoudianLoginPage(page)) {
      throw new Error('自动化浏览器未登录：请先在店铺浏览器完成登录并保存登录状态');
    }

    const result = await configureSearchAfterViewPage(page, draft);
    if (!result) {
      // A signal-backed queue keeps the same page between successful rows, but
      // the page is no longer needed once the list is exhausted.
      closePage = true;
      return null;
    }
    if (options.autoSubmit === false) return { ...result, submitted: false };

    await runSearchAfterViewAbortable(() => page.waitForTimeout(3_000), options.signal);
    throwIfSearchAfterViewTaskAborted(options.signal);
    await runSearchAfterViewAbortable(() => page.getByRole('button', { name: '立即提交', exact: true }).click(), options.signal);
    await runSearchAfterViewAbortable(() => page.getByRole('button', { name: '立即提交', exact: true }).waitFor({ state: 'hidden', timeout: 10_000 }), options.signal);
    await waitForSearchAfterViewList(page);
    return { ...result, submitted: true };
  } catch (caught) {
    if (options.signal?.aborted) {
      closePage = true;
      throw new SearchAfterViewTaskAbortedError();
    }
    if (caught instanceof SearchAfterViewRowError) await returnToSearchAfterViewList(page);
    else closePage = !options.signal;
    throw caught;
  } finally {
    if (closePage) await closeSearchAfterViewTaskPage(options.signal, page);
  }
}

export async function getSearchAfterViewTaskPage(profile: ShopAuthStorage, signal?: AbortSignal) {
  const active = signal ? taskPages.get(signal) : undefined;
  if (active && !active.page.isClosed()) return active.page;

  const { page } = await openDoudianShopPage(profile, DOUDIAN_SEARCH_AFTER_VIEW_URL, {
    // Show the saved shop browser while the task runs, then reuse this page
    // for every row in the same task.
    headless: false,
    newPage: false
  });
  // A new task always starts at the first list page; the same task keeps the
  // current page while it advances row by row.
  preparedSearchAfterViewPages.delete(page);
  page.setDefaultTimeout(15_000);
  if (!signal) return page;

  const taskPage: SearchAfterViewTaskPage = {
    page,
    onAbort: () => { void closeSearchAfterViewTaskPage(signal); }
  };
  taskPages.set(signal, taskPage);
  signal.addEventListener('abort', taskPage.onAbort, { once: true });
  if (signal.aborted) {
    await closeSearchAfterViewTaskPage(signal);
    throw new SearchAfterViewTaskAbortedError();
  }
  return page;
}

async function closeSearchAfterViewTaskPage(signal?: AbortSignal, fallbackPage?: Page) {
  const taskPage = signal ? taskPages.get(signal) : undefined;
  if (taskPage) {
    const closing = taskPage.closing ??= taskPage.page.close().catch(() => undefined);
    taskPages.delete(signal!);
    signal!.removeEventListener('abort', taskPage.onAbort);
    return closing;
  }
  if (!signal) await fallbackPage?.close().catch(() => undefined);
}

async function returnToSearchAfterViewList(page: Page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await isSearchAfterViewListPage(page)) return;
    await closeSearchAfterViewDrawer(page).catch(() => page.keyboard.press('Escape').catch(() => undefined));
    await page.waitForTimeout(200);
  }
  throw new Error('无法关闭当前配置弹窗并返回视频列表');
}

export async function closeSearchAfterViewDrawer(page: Pick<Page, 'locator'> & Partial<Pick<Page, 'keyboard'>>) {
  try {
    await page.locator('button.auxo-drawer-close:visible').last().click({ force: true, timeout: 1_000 });
  } catch (error) {
    if (!page.keyboard) throw error;
    await page.keyboard.press('Escape');
  }
}

async function waitForSearchAfterViewList(page: Page) {
  for (let attempt = 0; attempt < 75; attempt += 1) {
    if (await isSearchAfterViewListPage(page)) return;
    await page.waitForTimeout(200);
  }
  throw new Error('提交后未返回视频列表');
}

export function isSearchAfterViewListReady(filterVisible: boolean, drawerVisible: boolean) {
  return filterVisible && !drawerVisible;
}

export function isSearchAfterViewPageBusy(visibleBlockerCount: number) {
  return visibleBlockerCount > 0;
}

export function shouldResetSearchAfterViewPagination(activePageText: string | null) {
  return activePageText?.trim() !== '1';
}

async function isSearchAfterViewListPage(page: Page) {
  const filterVisible = await page.getByText('配置状态', { exact: true }).isVisible().catch(() => false);
  const drawerVisible = await visibleSearchAfterViewDrawerCount(page) > 0;
  return isSearchAfterViewListReady(filterVisible, drawerVisible);
}

export async function configureSearchAfterViewPage(
  page: Page,
  input: Pick<SearchAfterViewDraft, 'keywords' | 'sku' | 'skippedVideoIds'>
): Promise<Omit<SearchAfterViewResult, 'submitted'> | null> {
  const keywords = validateSearchAfterViewKeywords(input.keywords);
  await closeOpenSearchAfterViewDrawers(page);
  if (!preparedSearchAfterViewPages.has(page)) {
    await applySearchAfterViewFilters(page);
    preparedSearchAfterViewPages.add(page);
  } else {
    await waitForSearchAfterViewList(page);
  }

  const target = await findTargetVideo(page, input.sku, input.skippedVideoIds);
  if (!target) return null;
  const { row, sku, title: videoTitle, videoId } = target;

  let products: SearchAfterViewProduct[];
  let mainProductId: string | null;
  try {
    await waitBeforeSearchAfterViewConfigure(page);
    const currentRowText = await row.innerText();
    if (!isSearchAfterViewVideoRowMatch(currentRowText, videoId)) {
      throw new Error(`列表行已变化：期望视频 ${videoId}`);
    }
    await row.getByRole('button', { name: '立即配置', exact: true }).click();
    await page.getByText(/添加承接商品/).last().waitFor({ state: 'visible' });
    await waitForSearchAfterViewDrawerMatch(page, videoId, videoTitle);
    const drawerSku = await readSearchAfterViewTitleSku(page, sku);
    if (drawerSku !== sku) {
      throw new Error(`配置抽屉款号不一致：期望 ${sku}，实际 ${drawerSku ?? '未识别'}`);
    }

    products = await selectSearchAfterViewProducts(page, sku);
    mainProductId = chooseSearchAfterViewMainProduct(products);
    if (mainProductId) await setMainProduct(page, mainProductId);
    await confirmSelectedProducts(page);
    await fillSearchAfterViewKeywords(page, keywords);
  } catch (caught) {
    throw new SearchAfterViewRowError(videoId, caught instanceof Error ? caught.message : '看后搜配置失败');
  }

  return {
    videoId,
    sku,
    productIds: products.map((product) => product.id),
    mainProductId
  };
}

async function waitForSearchAfterViewDrawerMatch(page: Page, videoId: string, videoTitle: string) {
  let lastDrawerText = '';
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const drawer = page.locator('div.auxo-drawer:visible').last();
    lastDrawerText = await drawer.evaluate((element) => {
      const values = [...element.querySelectorAll('input, textarea, [contenteditable="true"]')]
        .map((control) => control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
          ? control.value
          : control.textContent ?? '');
      return [element.textContent ?? '', ...values].join(' ');
    }).catch(() => '');
    if (isSearchAfterViewDrawerMatch(lastDrawerText, videoId, videoTitle)) return;
    await page.waitForTimeout(250);
  }
  throw new Error(`配置抽屉与列表视频不一致：期望视频 ${videoId}；实际抽屉：${lastDrawerText.replace(/\s+/g, ' ').slice(0, 260)}`);
}

async function closeOpenSearchAfterViewDrawers(page: Pick<Page, 'locator' | 'waitForTimeout'>) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await visibleSearchAfterViewDrawerCount(page) === 0) return;
    await closeSearchAfterViewDrawer(page).catch(() => undefined);
    await page.waitForTimeout(400);
  }
  if (await visibleSearchAfterViewDrawerCount(page) > 0) {
    throw new Error('无法关闭上一条看后搜配置抽屉');
  }
}

async function visibleSearchAfterViewDrawerCount(page: Pick<Page, 'locator'>) {
  return page.locator('div.auxo-drawer-mask:visible, div.auxo-drawer:visible').count();
}

async function readSearchAfterViewTitleSku(page: Page, expectedSku: string) {
  const heading = page.getByText('设置视频标题', { exact: true }).last();
  await heading.waitFor({ state: 'visible' });

  // The drawer shell becomes visible before the video title is rendered. Poll
  // the same visible drawer briefly instead of treating that intermediate DOM
  // state as a mismatched SKU.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    for (const scope of [heading.locator('xpath=..'), heading.locator('xpath=../..'), page.locator('div.auxo-drawer:visible').last()]) {
      const title = await scope.evaluate((element) => {
        const values = [...element.querySelectorAll('input, textarea, [contenteditable="true"]')]
          .map((control) => control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
            ? control.value
            : control.textContent ?? '');
        return [element.textContent ?? '', ...values].join('\n');
      }).catch(() => '');
      const sku = resolveSearchAfterViewTitleSku(title, expectedSku);
      if (sku) return sku;
    }
    await page.waitForTimeout(250);
  }
  return null;
}

export async function waitBeforeSearchAfterViewConfigure(page: Pick<Page, 'waitForTimeout'>) {
  await page.waitForTimeout(3_000);
}

async function applySearchAfterViewFilters(page: Page) {
  try {
    await page.getByText('配置状态', { exact: true }).waitFor({ state: 'visible', timeout: 45_000 });
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '');
    const context = body.replace(/\s+/g, ' ').slice(0, 240);
    throw new Error(`看后搜页面未加载：${page.url()}；标题：${await page.title().catch(() => '')}；页面文字：${context}`, { cause: error });
  }
  await page.getByText('配置状态', { exact: true }).scrollIntoViewIfNeeded();
  // Wait for the status counters to finish their first render. On a fresh
  // navigation the temporary value can be “待配置 0” even though rows arrive
  // moments later.
  await page.waitForTimeout(1_000);
  const pendingFilter = page.locator('div[class*="tagList_"]:visible').first()
    .locator('div[class*="tagItem_"]:visible')
    .filter({ hasText: /^待配置(?:\s|$)/ });
  await pendingFilter.waitFor({ state: 'visible' });
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
  await resetSearchAfterViewPagination(page);
  const firstRow = page.locator('tr.ecom-table-row:visible').first();
  await firstRow.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
  if (await firstRow.isVisible().catch(() => false)) await firstRow.scrollIntoViewIfNeeded();
}

async function resetSearchAfterViewPagination(page: Page) {
  const activePage = page.locator('li.ecom-pagination-item-active:visible, [aria-current="page"]:visible').first();
  const activeText = await activePage.textContent().catch(() => null);
  if (!shouldResetSearchAfterViewPagination(activeText)) return;

  const firstPage = page.locator('[class*="pagination"]:visible').last().getByText('1', { exact: true }).last();
  if (!await firstPage.isVisible().catch(() => false)) return;
  const previousRow = await searchAfterViewDataRows(page).first().innerText().catch(() => '');
  await firstPage.click();
  await page.waitForFunction(
    (previousRow) => {
      const visible = (element: Element) => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      };
      const row = [...document.querySelectorAll('tr.ecom-table-row, tr, [role="row"]')]
        .find((element) => visible(element) && /短视频\s*ID/.test(element.textContent ?? ''));
      return Boolean(row?.textContent?.trim() && row.textContent.trim() !== previousRow.trim());
    },
    previousRow,
    { timeout: 10_000 }
  ).catch(() => undefined);
}

async function findTargetVideo(page: Page, expectedSku?: string, skippedVideoIds: string[] = []): Promise<SearchAfterViewVideoTarget | null> {
  const skipped = new Set(skippedVideoIds);
  for (;;) {
    const rows = await page.locator('tr.ecom-table-row:visible').all();
    for (const row of rows) {
      const text = await row.innerText();
      if (!text.includes('待配置')) continue;
      if (!await row.getByRole('button', { name: '立即配置', exact: true }).count()) continue;
      const sku = extractSearchAfterViewSku(text);
      const videoId = text.match(/ID\s*(\d{10,})/)?.[1];
      if (videoId && skipped.has(videoId)) continue;
      if (videoId && sku && (!expectedSku || sku === expectedSku || text.includes(expectedSku))) {
        const title = text.split(/\s+短视频\s+ID\s*/)[0];
        const stableRow = page.locator('tr.ecom-table-row:visible')
          .filter({ hasText: videoId })
          .first();
        return { row: stableRow, sku, title, videoId };
      }
    }
    if (!await goToNextSearchAfterViewPage(page)) break;
  }
  return null;
}

export async function goToNextSearchAfterViewPage(page: Page) {
  const selectors = [
    'button[aria-label*="下一页"]:visible',
    '[role="button"][aria-label*="下一页"]:visible',
    'button[title*="下一页"]:visible',
    'li[title*="下一页"]:visible button',
    'li[aria-label*="下一页"]:visible button',
    'li.ecom-pagination-next:visible button',
    'li[class*="pagination"][class*="next"]:visible button',
    'button[class*="pagination-next"]:visible',
    '[class*="pagination"] button:visible'
  ];

  let next: Locator | undefined;
  for (const selector of selectors) {
    const candidates = await page.locator(selector).all();
    for (const candidate of candidates) {
      if (!await candidate.isVisible().catch(() => false)) continue;
      if (selector === '[class*="pagination"] button:visible' && !await isSearchAfterViewNextButton(candidate)) continue;
      if (await isSearchAfterViewPaginationDisabled(candidate)) return false;
      next = candidate;
      break;
    }
    if (next) break;
  }
  if (!next) {
    const nextContainer = page.locator('[class*="pagination"]:visible').filter({ hasText: /下一页/ }).last();
    const candidate = nextContainer.getByRole('button').last();
    if (await candidate.isVisible().catch(() => false)) next = candidate;
  }
  if (!next) {
    // Some versions render “下一页” as a sibling label rather than on the
    // button itself; resolve the button from that visible label's ancestors.
    const label = page.getByText('下一页', { exact: true }).last();
    for (const scope of [label.locator('xpath=..'), label.locator('xpath=../..'), label.locator('xpath=../../..')]) {
      const candidate = scope.getByRole('button').last();
      if (await candidate.isVisible().catch(() => false)) {
        next = candidate;
        break;
      }
    }
  }
  if (!next) return false;

  const activePage = page.locator('li.ecom-pagination-item-active:visible, [aria-current="page"]:visible').first();
  const previousPage = await activePage.getAttribute('title').catch(() => null) ??
    await activePage.textContent().catch(() => null);
  const firstRow = searchAfterViewDataRows(page).first();
  const previousRow = await firstRow.innerText().catch(() => '');
  await waitForSearchAfterViewPageIdle(page);
  await next.click();
  try {
    await page.waitForFunction(
      ({ previousPage, previousRow }) => {
        const visible = (element: Element) => {
          const style = window.getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden';
        };
        const active = [...document.querySelectorAll('li.ecom-pagination-item-active, [aria-current="page"]')]
          .find(visible);
        const row = [...document.querySelectorAll('tr.ecom-table-row, tr, [role="row"]')]
          .find((element) => visible(element) && /短视频\s*ID/.test(element.textContent ?? ''));
        const currentPage = active?.getAttribute('title') ?? active?.textContent?.trim() ?? null;
        return currentPage !== previousPage || row?.textContent?.trim() !== previousRow.trim();
      },
      { previousPage, previousRow },
      { timeout: 10_000 }
    );
    return true;
  } catch {
    // A page can change without exposing an active-page attribute. Re-check
    // the real data row before declaring pagination failed.
    const currentRow = await searchAfterViewDataRows(page).first().innerText().catch(() => '');
    return Boolean(currentRow.trim() && currentRow.trim() !== previousRow.trim());
  }
}

async function waitForSearchAfterViewPageIdle(page: Pick<Page, 'locator' | 'waitForTimeout'>) {
  const blockers = page.locator('.ecom-spin-container.ecom-spin-blur:visible, .mona-loading-mask:visible');
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const count = typeof (blockers as { count?: unknown }).count === 'function'
      ? await blockers.count().catch(() => 0)
      : 0;
    if (!isSearchAfterViewPageBusy(count)) return;
    await page.waitForTimeout(250);
  }
  throw new Error('看后搜列表仍在加载，未点击下一页');
}

function searchAfterViewDataRows(page: Pick<Page, 'locator'>) {
  const rows = page.locator('tr.ecom-table-row:visible');
  // Keep the helper compatible with the small locator doubles used by tests.
  return typeof (rows as { filter?: unknown }).filter === 'function'
    ? rows.filter({ hasText: /短视频\s*ID/ })
    : rows;
}

async function isSearchAfterViewPaginationDisabled(button: Locator) {
  return button.evaluate((element) => {
    let current: Element | null = element;
    for (let depth = 0; current && depth < 4; depth += 1, current = current.parentElement) {
      if (current.matches(':disabled') || current.getAttribute('aria-disabled') === 'true') return true;
      if (/\bdisabled\b/i.test(current.getAttribute('class') ?? '')) return true;
    }
    return false;
  }).catch(async () => await button.isDisabled().catch(() => false));
}

async function isSearchAfterViewNextButton(button: Locator) {
  return button.evaluate((element) => {
    const text = [
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('class')
    ].filter(Boolean).join(' ');
    return /下一页|next|›|>|chevron[-_ ]?right/i.test(text);
  }).catch(() => false);
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
  const productDrawer = page.locator('div.auxo-drawer:visible').last();
  const search = productDrawer.getByPlaceholder('请输入商品ID/商品名称', { exact: true });
  await search.waitFor({ state: 'visible' });
  // The picker first renders its existing product list. Do not type the SKU
  // into a half-mounted drawer; wait until the list below is actually ready.
  await waitForSearchAfterViewProductPicker(page, productDrawer);
  await search.fill(sku);
  await search.press('Enter');
  await waitForSearchAfterViewProductResults(page, productDrawer, sku);

  const products: SearchAfterViewProduct[] = [];
  const rows = productDrawer.locator('tr.ecom-table-row:visible')
    .filter({ hasText: sku })
    .filter({ has: productDrawer.locator('input.ecom-checkbox-input') });
  await rows.first().waitFor({ state: 'visible' });
  for (const row of await rows.all()) {
    const checkbox = row.locator('input.ecom-checkbox-input').first();
    if (!await checkbox.isChecked()) await checkbox.check({ force: true });
    await page.waitForTimeout(800);
    const text = await row.innerText();
    const id = await row.getAttribute('data-row-key') ?? text.match(/ID\s*(\d{10,})/)?.[1];
    if (id) products.push({ id, title: text });
  }
  if (products.length === 0) {
    const candidateRows = await productDrawer.locator('tr.ecom-table-row:visible').filter({ hasText: sku }).all();
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

export async function waitForSearchAfterViewProductPicker(page: Pick<Page, 'waitForTimeout'>, productDrawer: Locator) {
  const rows = productDrawer.locator('tr.ecom-table-row:visible')
    .filter({ hasText: /ID\s*\d{10,}/ });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await rows.first().isVisible().catch(() => false)) return;
    await page.waitForTimeout(250);
  }
  throw new Error('商品选择列表未加载');
}

async function waitForSearchAfterViewProductResults(page: Pick<Page, 'waitForTimeout'>, productDrawer: Locator, sku: string) {
  const rows = productDrawer.locator('tr.ecom-table-row:visible')
    .filter({ hasText: sku })
    .filter({ has: productDrawer.locator('input.ecom-checkbox-input') });
  const emptyState = productDrawer.getByText(/暂无搜索结果|暂无关联商品|暂无商品/).last();

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await rows.first().isVisible().catch(() => false)) return;
    if (await emptyState.isVisible().catch(() => false)) {
      throw new Error(`商品搜索无匹配结果：${sku}`);
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`商品搜索结果未加载：${sku}`);
}

async function setMainProduct(page: Page, productId: string) {
  const card = page.getByText(`ID ${productId}`, { exact: true }).last().locator('xpath=../../../../..');
  const button = card.getByRole('button', { name: '设置主推', exact: true });
  if (await button.count()) await button.click();
}

async function confirmSelectedProducts(page: Page) {
  const button = await bottomVisibleButton(page, '确定');
  await button.click();
  await page.waitForTimeout(1_200);
  await page.getByText(/添加承接商品 1\/5|添加承接商品 2\/5|添加承接商品 3\/5|添加承接商品 4\/5|添加承接商品 5\/5/)
    .waitFor({ state: 'visible' });
}

async function fillSearchAfterViewKeywords(page: Page, keywords: string[]) {
  const input = page.locator('input.ecom-input-tag-input');
  for (const keyword of keywords) {
    await input.last().click({ force: true });
    await input.fill(keyword);
    await input.press('Enter');
    await page.waitForTimeout(1_000);
    await page.getByText(keyword, { exact: true }).last().waitFor({ state: 'visible', timeout: 3_000 }).catch(async () => {
      await input.last().click({ force: true });
      await input.press('Enter');
      await page.getByText(keyword, { exact: true }).last().waitFor({ state: 'visible', timeout: 3_000 });
    });
  }
  await confirmSearchAfterViewKeywords(page);
}

export async function confirmSearchAfterViewKeywords(page: Pick<Page, 'locator'>) {
  const keywordBox = page.locator('div.ecom-input-tag:visible').last();
  const box = await keywordBox.boundingBox();
  if (!box) throw new Error('看后搜词框不可点击');
  await keywordBox.click({ force: true, position: { x: Math.max(8, box.width / 2), y: Math.max(8, box.height / 2) } });
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

function throwIfSearchAfterViewTaskAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new SearchAfterViewTaskAbortedError();
}
