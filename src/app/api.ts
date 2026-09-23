import type { CouponBatch, CouponRow, NewcomerGiftBatch, NewcomerGiftRow, NewShop, Shop, ShopStatus } from '../shared/types';
import type { ProductSelectionMode } from '../rpa/priceRange';

export type VideoFrameExtractionJob = {
  id: string;
  status: 'processing' | 'complete' | 'failed';
  progress: number;
  settings: { mode: 'random' | 'interval'; value: number };
  outputName: string;
  outputSize?: number;
  duration?: number;
  error?: string;
  previewUrl?: string;
  downloadUrl?: string;
};

export type SearchAfterViewTask = {
  id: string;
  shopId: string;
  status: 'running' | 'paused' | 'complete' | 'failed';
  configured: number;
  errors: number;
  currentVideoId: string | null;
  currentSku: string | null;
  message: string;
};

export async function getShops() {
  const response = await fetch('/api/shops');
  return readJson<Shop[]>(response);
}

export async function addShop(input: NewShop) {
  const response = await fetch('/api/shops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  return readJson<Shop>(response);
}

export async function setCurrentShop(shopId: string) {
  const response = await fetch(`/api/shops/${shopId}/current`, { method: 'POST' });
  return readJson<{ ok: boolean }>(response);
}

export async function deleteShop(shopId: string) {
  const response = await fetch(`/api/shops/${shopId}`, { method: 'DELETE' });
  return readJson<{ ok: boolean }>(response);
}

export async function openShopLogin(shopId: string) {
  const response = await fetch(`/api/shops/${shopId}/open-login`, { method: 'POST' });
  return readJson<{ opened: boolean; reused: boolean }>(response);
}

export async function saveShopLogin(shopId: string) {
  const response = await fetch(`/api/shops/${shopId}/save-cookies`, { method: 'POST' });
  return readJson<{ saved: boolean; count: number }>(response);
}

export async function setShopStatus(shopId: string, status: ShopStatus) {
  const response = await fetch(`/api/shops/${shopId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  return readJson<{ ok: boolean }>(response);
}

export async function syncShop(shopId: string) {
  const response = await fetch(`/api/shops/${shopId}/sync`, { method: 'POST' });
  return readJson<Shop>(response);
}

export async function createCouponBatch(input: {
  shopId: string;
  fileName: string;
  rows: CouponRow[];
  concurrency?: number;
}) {
  const response = await fetch('/api/coupon-batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  return readJson<CouponBatch>(response);
}

export async function getCouponBatch(batchId: string) {
  const response = await fetch(`/api/coupon-batches/${batchId}`);
  return readJson<CouponBatch>(response);
}

export async function stopCouponBatch(batchId: string) {
  const response = await fetch(`/api/coupon-batches/${batchId}/stop`, { method: 'POST' });
  return readJson<CouponBatch>(response);
}

export async function createProductCouponBatch(input: {
  shopId: string;
  fileName: string;
  rows: CouponRow[];
  concurrency?: number;
  selectionMode?: ProductSelectionMode;
}) {
  const response = await fetch('/api/product-coupon-batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  return readJson<CouponBatch>(response);
}

export async function getProductCouponBatch(batchId: string) {
  const response = await fetch(`/api/product-coupon-batches/${batchId}`);
  return readJson<CouponBatch>(response);
}

export async function stopProductCouponBatch(batchId: string) {
  const response = await fetch(`/api/product-coupon-batches/${batchId}/stop`, { method: 'POST' });
  return readJson<CouponBatch>(response);
}

export async function createNewcomerGiftBatch(input: {
  shopId: string;
  fileName: string;
  rows: NewcomerGiftRow[];
  concurrency?: number;
}) {
  const response = await fetch('/api/newcomer-gift-batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  return readJson<NewcomerGiftBatch>(response);
}

export async function getNewcomerGiftBatch(batchId: string) {
  const response = await fetch(`/api/newcomer-gift-batches/${batchId}`);
  return readJson<NewcomerGiftBatch>(response);
}

export async function stopNewcomerGiftBatch(batchId: string) {
  const response = await fetch(`/api/newcomer-gift-batches/${batchId}/stop`, { method: 'POST' });
  return readJson<NewcomerGiftBatch>(response);
}

export async function createVideoFrameExtraction(file: File, settings: { mode: 'random' | 'interval'; value: number }) {
  const form = new FormData();
  form.append('video', file);
  form.append('mode', settings.mode);
  form.append('value', String(settings.value));
  const response = await fetch('/api/video-frame-extraction', {
    method: 'POST',
    body: form
  });
  return readJson<VideoFrameExtractionJob>(response);
}

export async function getVideoFrameExtraction(jobId: string) {
  const response = await fetch(`/api/video-frame-extraction/${jobId}`);
  return readJson<VideoFrameExtractionJob>(response);
}

export async function startSearchAfterView(input: { shopId: string; keywords: string[] }) {
  const response = await fetch('/api/search-after-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, autoSubmit: true })
  });
  return readJson<SearchAfterViewTask>(response);
}

export async function getSearchAfterViewTask(taskId: string) {
  const response = await fetch(`/api/search-after-view/${taskId}`);
  return readJson<SearchAfterViewTask>(response);
}

export async function pauseSearchAfterViewTask(taskId: string) {
  const response = await fetch(`/api/search-after-view/${taskId}/pause`, { method: 'POST' });
  return readJson<SearchAfterViewTask>(response);
}

async function readJson<T>(response: Response) {
  const text = (await response.text()).trim();
  const body = text ? parseJson(text) : null;
  if (!response.ok) {
    throw new Error(body?.error ?? `请求失败：${response.status}`);
  }
  if (!body) throw new Error('接口没有返回数据');
  return body as T;
}

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('接口返回格式不正确，请确认后端服务正在运行');
  }
}
