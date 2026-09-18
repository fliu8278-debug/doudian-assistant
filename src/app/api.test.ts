import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProductCouponBatch, createVideoFrameExtraction, deleteShop, getVideoFrameExtraction } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('video frame extraction API', () => {
  it('uploads the selected video and sparse frame settings as form data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'job-1', status: 'processing', progress: 1, settings: { mode: 'interval', value: 3 }, outputName: 'clip_every_3s.mp4'
    }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });

    const job = await createVideoFrameExtraction(file, { mode: 'interval', value: 3 });

    expect(job.id).toBe('job-1');
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock).toHaveBeenCalledWith('/api/video-frame-extraction', expect.objectContaining({ method: 'POST' }));
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get('video')).toBe(file);
    expect((request.body as FormData).get('mode')).toBe('interval');
    expect((request.body as FormData).get('value')).toBe('3');
  });

  it('reads a completed job including its download URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'job-1', status: 'complete', progress: 100, settings: { mode: 'random', value: 1 }, outputName: 'clip_random_1frames.mp4',
      downloadUrl: '/api/video-frame-extraction/job-1/download'
    }))));

    const job = await getVideoFrameExtraction('job-1');

    expect(job.downloadUrl).toBe('/api/video-frame-extraction/job-1/download');
  });
});

describe('shop API', () => {
  it('deletes a selected shop', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);

    await deleteShop('shop-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/shops/shop-1', { method: 'DELETE' });
  });
});

describe('product coupon API', () => {
  it('sends product coupon batches to their own endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'batch-1', tasks: [] })));
    vi.stubGlobal('fetch', fetchMock);

    await createProductCouponBatch({ shopId: 'shop-1', fileName: '商品券.xlsx', rows: [], concurrency: 1 });

    expect(fetchMock).toHaveBeenCalledWith('/api/product-coupon-batches', expect.objectContaining({ method: 'POST' }));
  });
});
