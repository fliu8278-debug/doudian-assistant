import type { Locator, Page } from 'playwright';
import type { ShopAuthStorage } from '../db/shops';
import { openDoudianShopPage } from './doudianSession';

export const DOUDIAN_SEARCH_AFTER_VIEW_URL = 'https://fxg.jinritemai.com/ffa/mcompass/search/video';
const SEARCH_AFTER_VIEW_SETTLE_DELAY_MS = 750;
const SEARCH_AFTER_VIEW_SKU_CHAR_DELAY_MS = 80;
const SEARCH_AFTER_VIEW_MAIN_PRODUCT_POLL_DELAY_MS = 50;

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

export type SearchAfterViewCandidateRow = {
  title: string;
  videoId: string | null;
  pending: boolean;
  hasConfigure: boolean;
};

export type SearchAfterViewCandidate = {
  videoId: string;
  sku: string;
  title: string;
};

export type SearchAfterViewResult = {
  submitted: boolean;
  videoId: string;
  sku: string;
  productIds: string[];
  mainProductId: string | null;
};

export type SearchAfterViewTargetProgress = {
  videoId: string;
  sku: string;
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
const scannedSearchAfterViewPages = new WeakMap<Page, SearchAfterViewCandidate[]>();
const WAIT_FOR_SEARCH_AFTER_VIEW_FIRST_ROW_CHANGE = String.raw`(previousRow) => {
  const visible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };
  const row = [...document.querySelectorAll('tr.ecom-table-row, tr, [role="row"]')]
    .find((element) => visible(element) && /短视频\s*ID/.test(element.textContent ?? ''));
  return Boolean(row?.textContent?.trim() && row.textContent.trim() !== previousRow.trim());
}`;
const WAIT_FOR_SEARCH_AFTER_VIEW_PAGE_CHANGE = String.raw`({ previousPage, previousRow }) => {
  const visible = (element) => {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };
  const active = [...document.querySelectorAll('li.ecom-pagination-item-active, [aria-current="page"]')]
    .find(visible);
  const row = [...document.querySelectorAll('tr.ecom-table-row, tr, [role="row"]')]
    .find((element) => visible(element) && /短视频\s*ID/.test(element.textContent ?? ''));
  const currentPage = active?.getAttribute('title') ?? active?.textContent?.trim() ?? null;
  const currentRow = row?.textContent?.trim() ?? '';
  const rowChanged = Boolean(currentRow && currentRow !== previousRow.trim());
  const pageChanged = currentPage !== previousPage;
  return rowChanged && (pageChanged || !currentPage || !previousPage);
}`;

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

export function parseSearchAfterViewRowMetadata(title: string, rowText: string): SearchAfterViewCandidateRow {
  return {
    title: (title.trim() || rowText).trim(),
    videoId: rowText.match(/(?:短视频\s*)?ID\s*(\d{10,})/)?.[1] ?? null,
    pending: rowText.includes('待配置'),
    hasConfigure: rowText.includes('立即配置')
  };
}

export function collectSearchAfterViewCandidates(rows: SearchAfterViewCandidateRow[]): SearchAfterViewCandidate[] {
  return rows.flatMap(({ title, videoId, pending, hasConfigure }) => {
    if (!pending || !hasConfigure || !videoId) return [];
    const sku = extractSearchAfterViewSku(title);
    if (!videoId || !sku) return [];
    return [{ videoId, sku, title: title.trim() }];
  });
}

export function findSearchAfterViewCandidateRowIndex(
  rows: SearchAfterViewCandidateRow[],
  candidate: SearchAfterViewCandidate
) {
  return rows.findIndex((row) => (
    row.pending &&
    row.hasConfigure &&
    row.videoId === candidate.videoId &&
    extractSearchAfterViewSku(row.title) === candidate.sku
  ));
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

export function isSearchAfterViewVideoTargetMatch(rowTitle: string, rowText: string, videoId: string, sku: string) {
  return isSearchAfterViewVideoRowMatch(rowText, videoId) && extractSearchAfterViewSku(rowTitle) === sku;
}

export async function hasSearchAfterViewConfigureAction(row: Locator) {
  return (
    await row.getByRole('button', { name: '立即配置', exact: true }).count() > 0 ||
    await row.getByRole('link', { name: '立即配置', exact: true }).count() > 0 ||
    await row.getByText('立即配置', { exact: true }).count() > 0
  );
}

async function getSearchAfterViewConfigureAction(row: Locator) {
  const button = row.getByRole('button', { name: '立即配置', exact: true });
  if (await button.count()) return button.first();
  const link = row.getByRole('link', { name: '立即配置', exact: true });
  if (await link.count()) return link.first();
  const text = row.getByText('立即配置', { exact: true });
  if (await text.count()) return text.first();
  throw new Error('当前视频行没有立即配置入口');
}

export function validateSearchAfterViewKeywords(keywords: string[]) {
  const values = keywords.map((value) => value.trim()).filter(Boolean);
  if (values.length < 1 || values.length > 3) throw new Error('看后搜词需要填写 1 至 3 个');
  return values;
}

export function chooseSearchAfterViewMainProduct(products: SearchAfterViewProduct[]) {
  return products.find((product) => !product.title.includes('国补'))?.id ?? null;
}

export function isSearchAfterViewMainProductConfirmed(drawerText: string) {
  return drawerText.replace(/\s+/g, ' ').includes('已成功设为主推品');
}

export async function submitSearchAfterViewTask(
  profile: ShopAuthStorage,
  draft: SearchAfterViewDraft,
  options: {
    autoSubmit?: boolean;
    signal?: AbortSignal;
    onTarget?: (target: SearchAfterViewTargetProgress) => void;
  } = {}
): Promise<SearchAfterViewResult | null> {
  throwIfSearchAfterViewTaskAborted(options.signal);
  const page = await getSearchAfterViewTaskPage(profile, options.signal);
  let closePage = !options.signal;

  try {
    throwIfSearchAfterViewTaskAborted(options.signal);
    if (await isDoudianLoginPage(page)) {
      throw new Error('自动化浏览器未登录：请先在店铺浏览器完成登录并保存登录状态');
    }

    const result = await configureSearchAfterViewPage(page, draft, { onTarget: options.onTarget });
    if (!result) {
      // A signal-backed queue keeps the same page between successful rows, but
      // the page is no longer needed once the list is exhausted.
      closePage = true;
      return null;
    }
    if (options.autoSubmit === false) return { ...result, submitted: false };

    throwIfSearchAfterViewTaskAborted(options.signal);
    const submitButton = await bottomVisibleButton(page, '立即提交');
    await runSearchAfterViewAbortable(() => submitButton.click(), options.signal);
    await runSearchAfterViewAbortable(() => waitForSearchAfterViewSubmitCompletion(page), options.signal);
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
  scannedSearchAfterViewPages.delete(page);
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
    if (await isSearchAfterViewListPage(page)) {
      await waitForSearchAfterViewPageIdle(page);
      const firstRow = searchAfterViewDataRows(page).first();
      await firstRow.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
      if (await firstRow.isVisible().catch(() => false)) return;
    }
    await page.waitForTimeout(200);
  }
  throw new Error('提交后未返回视频列表');
}

export async function waitForSearchAfterViewSubmitCompletion(page: Page) {
  await waitForSearchAfterViewList(page);
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

export function isSearchAfterViewPageDataChanged(
  previousPage: string | null,
  currentPage: string | null,
  previousRow: string,
  currentRow: string
) {
  const rowChanged = Boolean(currentRow.trim() && currentRow.trim() !== previousRow.trim());
  const pageChanged = currentPage === null || previousPage === null || currentPage !== previousPage;
  return rowChanged && pageChanged;
}

async function isSearchAfterViewListPage(page: Page) {
  const filterVisible = await page.getByText('配置状态', { exact: true }).isVisible().catch(() => false);
  const drawerVisible = await visibleSearchAfterViewDrawerCount(page) > 0;
  return isSearchAfterViewListReady(filterVisible, drawerVisible);
}

export async function configureSearchAfterViewPage(
  page: Page,
  input: Pick<SearchAfterViewDraft, 'keywords' | 'sku' | 'skippedVideoIds'>,
  options: { onTarget?: (target: SearchAfterViewTargetProgress) => void } = {}
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
  const { sku, title: videoTitle, videoId } = target;
  options.onTarget?.({ videoId, sku });

  let products: SearchAfterViewProduct[];
  let mainProductId: string | null;
  try {
    await waitBeforeSearchAfterViewConfigure(page);
    const current = await findLiveSearchAfterViewCandidateRow(page, target);
    if (!current) throw new Error(`列表行已变化：期望视频 ${videoId}、款号 ${sku}`);
    const { row: currentRow, title: currentTitle } = current;
    const currentRowText = await currentRow.innerText();
    if (!isSearchAfterViewVideoTargetMatch(currentTitle, currentRowText, videoId, sku)) {
      throw new Error(`列表行已变化：期望视频 ${videoId}、款号 ${sku}`);
    }
    await (await getSearchAfterViewConfigureAction(currentRow)).click();
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
    lastDrawerText = await drawer.evaluate(function (element) {
      const values = [...element.querySelectorAll('input, textarea, [contenteditable="true"]')]
        .map(function (control) {
          return control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
            ? control.value
            : control.textContent ?? '';
        });
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
    const drawer = page.locator('div.auxo-drawer:visible').last();
    const titleContainer = drawer.locator('[id^="tag-input"]').last();
    const scopes = await titleContainer.count()
      ? [titleContainer, heading.locator('xpath=..'), heading.locator('xpath=../..'), drawer]
      : [heading.locator('xpath=..'), heading.locator('xpath=../..'), drawer];
    for (const scope of scopes) {
      const title = await scope.evaluate(function (element) {
        const values = [...element.querySelectorAll('input, textarea, [contenteditable="true"]')]
          .map(function (control) {
            return control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
              ? control.value
              : control.textContent ?? '';
          });
        return [element.getAttribute('value') ?? '', element.textContent ?? '', ...values].join('\n');
      }).catch(() => '');
      const sku = resolveSearchAfterViewTitleSku(title, expectedSku);
      if (sku) return sku;
    }
    await page.waitForTimeout(250);
  }
  return null;
}

export async function waitBeforeSearchAfterViewConfigure(page: Pick<Page, 'waitForTimeout'>) {
  await page.waitForTimeout(SEARCH_AFTER_VIEW_SETTLE_DELAY_MS);
}

export async function enterSearchAfterViewProductSku(search: Locator, sku: string) {
  await search.click();
  await search.fill('');
  await search.pressSequentially(sku, { delay: SEARCH_AFTER_VIEW_SKU_CHAR_DELAY_MS });
  await search.press('Enter');
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
  await waitForSearchAfterViewPageIdle(page);
  await waitForSearchAfterViewRowsStable(page);
  const firstRow = searchAfterViewDataRows(page).first();
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
    WAIT_FOR_SEARCH_AFTER_VIEW_FIRST_ROW_CHANGE,
    previousRow,
    { timeout: 10_000 }
  ).catch(() => undefined);
}

async function findTargetVideo(page: Page, expectedSku?: string, skippedVideoIds: string[] = []): Promise<SearchAfterViewVideoTarget | null> {
  const skipped = new Set(skippedVideoIds);
  for (;;) {
    let candidates = scannedSearchAfterViewPages.get(page);
    if (!candidates) {
      const { scannedRows } = await readSearchAfterViewScanRows(page);
      candidates = collectSearchAfterViewCandidates(scannedRows);
      scannedSearchAfterViewPages.set(page, candidates);
    }
    let staleCandidate = false;
    for (const candidate of candidates) {
      if (skipped.has(candidate.videoId)) continue;
      if (expectedSku && candidate.sku !== expectedSku) continue;
      const current = await findLiveSearchAfterViewCandidateRow(page, candidate);
      if (current) return { row: current.row, ...candidate };
      staleCandidate = true;
      break;
    }
    if (staleCandidate) {
      // The list can redraw after the ten-row scan. Re-scan this same page so
      // the next click still uses a live row with the matching ID and SKU.
      scannedSearchAfterViewPages.delete(page);
      continue;
    }
    if (!await goToNextSearchAfterViewPage(page)) break;
    scannedSearchAfterViewPages.delete(page);
  }
  return null;
}

async function findLiveSearchAfterViewCandidateRow(
  page: Page,
  candidate: SearchAfterViewCandidate
) {
  const { rows, scannedRows } = await readSearchAfterViewScanRows(page);
  const index = findSearchAfterViewCandidateRowIndex(scannedRows, candidate);
  return index < 0 ? null : { row: rows[index], title: scannedRows[index].title };
}

async function readSearchAfterViewScanRows(page: Page) {
  const rows = searchAfterViewDataRows(page);
  const rawRows = await rows.evaluateAll((elements) => elements.map((element) => ({
    title: element.querySelector<HTMLElement>('div[class*="videoTitle"]')?.innerText ?? '',
    text: (element as HTMLElement).innerText ?? element.textContent ?? ''
  })));
  return {
    rows: await rows.all(),
    scannedRows: rawRows.map(({ title, text }) => parseSearchAfterViewRowMetadata(title, text))
  };
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
      WAIT_FOR_SEARCH_AFTER_VIEW_PAGE_CHANGE,
      { previousPage, previousRow },
      { timeout: 10_000 }
    );
  } catch (error) {
    // The page callback can resolve during an intermediate render. The
    // locator-based check below waits for the settled first data row.
  }
  const changed = await waitForSearchAfterViewPageData(page, previousPage, previousRow);
  if (changed) {
    await waitForSearchAfterViewPageIdle(page);
    await waitForSearchAfterViewRowsStable(page);
  }
  return changed;
}

async function waitForSearchAfterViewPageData(
  page: Pick<Page, 'locator' | 'waitForTimeout'>,
  previousPage: string | null,
  previousRow: string
) {
  const activePage = page.locator('li.ecom-pagination-item-active:visible, [aria-current="page"]:visible').first();
  const firstRow = searchAfterViewDataRows(page).first();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const currentPage = await activePage.getAttribute('title').catch(() => null) ?? await activePage.textContent().catch(() => null);
    const currentRow = await firstRow.innerText().catch(() => '');
    if (isSearchAfterViewPageDataChanged(previousPage, currentPage, previousRow, currentRow)) return true;
    await page.waitForTimeout(250);
  }
  return false;
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

async function waitForSearchAfterViewRowsStable(page: Pick<Page, 'locator' | 'waitForTimeout'>) {
  const firstRow = searchAfterViewDataRows(page).first();
  let previous = '';
  let stable = 0;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const current = await firstRow.innerText().catch(() => '');
    if (current.trim() && current === previous) {
      stable += 1;
      // The list replaces its first render a few seconds after filtering.
      // Scan only after one full three-second stable window.
      if (stable >= 12) return;
    } else {
      stable = 0;
      previous = current;
    }
    await page.waitForTimeout(250);
  }
  throw new Error('看后搜列表数据未稳定，未继续配置');
}

function searchAfterViewDataRows(page: Pick<Page, 'locator'>) {
  const rows = page.locator('tr.ecom-table-row:visible');
  // Keep the helper compatible with the small locator doubles used by tests.
  return typeof (rows as { filter?: unknown }).filter === 'function'
    ? rows.filter({ hasText: /短视频\s*ID/ })
    : rows;
}

async function isSearchAfterViewPaginationDisabled(button: Locator) {
  return button.evaluate(function (element) {
    let current: Element | null = element;
    for (let depth = 0; current && depth < 4; depth += 1, current = current.parentElement) {
      if (current.matches(':disabled') || current.getAttribute('aria-disabled') === 'true') return true;
      if (/\bdisabled\b/i.test(current.getAttribute('class') ?? '')) return true;
    }
    return false;
  }).catch(async () => await button.isDisabled().catch(() => false));
}

async function isSearchAfterViewNextButton(button: Locator) {
  return button.evaluate(function (element) {
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
  await enterSearchAfterViewProductSku(search, sku);
  await waitForSearchAfterViewProductResults(page, productDrawer, sku);

  const products: SearchAfterViewProduct[] = [];
  const rows = productDrawer.locator('tr.ecom-table-row:visible')
    .filter({ hasText: sku });
  await rows.first().waitFor({ state: 'visible' });
  for (const row of await rows.all()) {
    const checkbox = row.locator('input.ecom-checkbox-input').first();
    if (!await checkbox.isChecked()) await checkbox.check({ force: true });
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

export async function waitForSearchAfterViewProductResults(page: Pick<Page, 'waitForTimeout'>, productDrawer: Locator, sku: string) {
  const rows = productDrawer.locator('tr.ecom-table-row:visible')
    .filter({ hasText: sku });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await rows.first().isVisible().catch(() => false)) return;
    await page.waitForTimeout(250);
  }
  throw new Error(`商品搜索无匹配结果：${sku}`);
}

async function setMainProduct(page: Page, productId: string) {
  const id = page.getByText(`ID ${productId}`, { exact: true }).last();
  await id.waitFor({ state: 'visible' });
  const card = id.locator('xpath=ancestor::*[.//*[normalize-space(.)="设置主推"]][1]');
  const button = card.getByRole('button', { name: '设置主推', exact: true });
  if (!await button.count()) throw new Error(`商品 ${productId} 没有找到设置主推按钮`);
  await clickSearchAfterViewMainProductButton(button);
  const drawer = page.locator('div.auxo-drawer:visible').last();
  try {
    await waitForSearchAfterViewMainProductConfirmation(page, drawer);
  } catch {
    throw new Error(`商品 ${productId} 设置主推后未确认成功`);
  }
}

export async function clickSearchAfterViewMainProductButton(button: Pick<Locator, 'waitFor' | 'evaluate'>) {
  await button.waitFor({ state: 'visible' });
  await button.evaluate((element) => {
    (element as HTMLElement).click();
  });
}

export async function waitForSearchAfterViewMainProductConfirmation(
  page: Pick<Page, 'waitForTimeout'> & Partial<Pick<Page, 'waitForFunction'>>,
  drawer: Pick<Locator, 'innerText'>
) {
  if (page.waitForFunction) {
    try {
      await page.waitForFunction(
        ({ selector, phrase }) => [...document.querySelectorAll(selector)].some((element) => {
          const style = window.getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden' && (element.textContent ?? '').includes(phrase);
        }),
        { selector: 'body', phrase: '已成功设为主推品' },
        { timeout: 5_000, polling: 50 }
      );
      return;
    } catch {
      // Older page variants do not expose the confirmation as a separate node.
    }
  }
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const text = await drawer.innerText().catch(() => '');
    if (isSearchAfterViewMainProductConfirmed(text)) return;
    await page.waitForTimeout(SEARCH_AFTER_VIEW_MAIN_PRODUCT_POLL_DELAY_MS);
  }
  throw new Error('设置主推后未确认成功');
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
