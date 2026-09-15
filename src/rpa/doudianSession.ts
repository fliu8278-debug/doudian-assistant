import { resolve } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import type { BrowserProfile } from './browser';
import { DOUDIAN_HOME_URL, loadShopCookies, saveShopCookies } from './browser';

type ContextBinding = BrowserProfile & {
  headless: boolean;
};

const activeContexts = new Map<string, BrowserContext>();
const activeContextBindings = new Map<string, ContextBinding>();
const startingContexts = new Map<string, { binding: ContextBinding; promise: Promise<BrowserContext> }>();

export async function openDoudianShopWindow(
  profile: BrowserProfile,
  url = DOUDIAN_HOME_URL
) {
  const { page, reused } = await openDoudianShopPage(profile, url, { headless: false });
  await page.bringToFront();
  return { opened: !reused, reused };
}

export async function openDoudianShopPage(
  profile: BrowserProfile,
  url = DOUDIAN_HOME_URL,
  options: { headless?: boolean; newPage?: boolean } = {}
): Promise<{ page: Page; reused: boolean }> {
  const headless = options.headless ?? activeContextBindings.get(profile.shopId)?.headless ?? true;
  const binding = contextBinding(profile, headless);
  await switchContextMode(binding);
  const hadContext = Boolean(activeContexts.get(binding.shopId));
  const context = await getOrStartContext(binding);
  await closeExtraBlankPages(context);
  const page = options.newPage
    ? await context.newPage()
    : findReusablePage(context.pages(), url) ?? await context.newPage();
  await page.bringToFront();
  if (!isSamePage(page.url(), url)) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }
  return { page, reused: hadContext };
}

async function closeExtraBlankPages(context: BrowserContext) {
  const blankPages = context.pages().filter((page) => page.url() === 'about:blank');
  await Promise.all(blankPages.slice(1).map((page) => page.close().catch(() => undefined)));
}

function findReusablePage(pages: Page[], url: string) {
  return (
    pages.find((page) => isSamePage(page.url(), url)) ??
    pages.find((page) => page.url() !== 'about:blank') ??
    pages[0]
  );
}

function isSamePage(currentUrl: string, targetUrl: string) {
  if (!currentUrl || currentUrl === 'about:blank') return false;
  try {
    const current = new URL(currentUrl);
    const target = new URL(targetUrl);
    return current.host === target.host && current.pathname === target.pathname;
  } catch {
    return currentUrl.startsWith(targetUrl);
  }
}

async function switchContextMode(binding: ContextBinding) {
  const starting = startingContexts.get(binding.shopId);
  if (starting && !sameBinding(starting.binding, binding)) {
    const context = await starting.promise.catch(() => undefined);
    if (context) await closeContext(context, starting.binding);
  }

  const existing = activeContexts.get(binding.shopId);
  const existingBinding = activeContextBindings.get(binding.shopId);
  if (!existing || !existingBinding || sameBinding(existingBinding, binding)) return;

  await closeContext(existing, existingBinding);
}

async function getOrStartContext(binding: ContextBinding) {
  const existing = activeContexts.get(binding.shopId);
  const existingBinding = activeContextBindings.get(binding.shopId);
  if (existing && existingBinding && sameBinding(existingBinding, binding)) return existing;

  const starting = startingContexts.get(binding.shopId);
  if (starting && sameBinding(starting.binding, binding)) return starting.promise;

  const promise = chromium.launchPersistentContext(binding.profilePath, {
    headless: binding.headless,
    viewport: { width: 1360, height: 860 },
    args: ['--no-proxy-server']
  }).then(async (context) => {
    activeContexts.set(binding.shopId, context);
    activeContextBindings.set(binding.shopId, binding);
    context.on('close', () => {
      activeContexts.delete(binding.shopId);
      activeContextBindings.delete(binding.shopId);
    });
    await loadShopCookies(context, binding);
    return context;
  }).finally(() => {
    const starting = startingContexts.get(binding.shopId);
    if (starting?.promise === promise) startingContexts.delete(binding.shopId);
  });

  startingContexts.set(binding.shopId, { binding, promise });
  return promise;
}

export async function saveDoudianShopCookies(profile: BrowserProfile) {
  const context = activeContexts.get(profile.shopId);
  if (!context) return { saved: false, count: 0 };
  const binding = activeContextBindings.get(profile.shopId);
  if (!binding || !sameStorage(binding, contextBinding(profile, binding.headless))) {
    return { saved: false, count: 0 };
  }

  const count = await saveShopCookies(context, binding);
  return { saved: true, count };
}

export async function closeDoudianShopPages(profile: BrowserProfile, urlPart: string) {
  const context = activeContexts.get(profile.shopId);
  if (!context) return 0;

  const pages = context.pages().filter((page) => page.url().includes(urlPart));
  await Promise.all(pages.map((page) => page.close().catch(() => undefined)));
  return pages.length;
}

async function closeContext(context: BrowserContext, binding: ContextBinding) {
  await saveShopCookies(context, binding).catch(() => undefined);
  await context.close().catch(() => undefined);
  activeContexts.delete(binding.shopId);
  activeContextBindings.delete(binding.shopId);
}

function contextBinding(profile: BrowserProfile, headless: boolean): ContextBinding {
  return {
    shopId: profile.shopId,
    profilePath: resolve(profile.profilePath),
    cookiePath: resolve(profile.cookiePath),
    headless
  };
}

function sameBinding(left: ContextBinding, right: ContextBinding) {
  return (
    sameStorage(left, right) &&
    left.headless === right.headless
  );
}

function sameStorage(left: BrowserProfile, right: BrowserProfile) {
  return (
    left.shopId === right.shopId &&
    left.profilePath === right.profilePath &&
    left.cookiePath === right.cookiePath
  );
}
