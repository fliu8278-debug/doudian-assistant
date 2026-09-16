import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVideoFrameExtraction, getVideoFrameExtraction } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('video frame extraction API', () => {
  it('uploads the selected video and target FPS as form data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'job-1', status: 'processing', progress: 1, targetFps: 15, outputName: 'clip_15fps.mp4'
    }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });

    const job = await createVideoFrameExtraction(file, 15);

    expect(job.id).toBe('job-1');
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock).toHaveBeenCalledWith('/api/video-frame-extraction', expect.objectContaining({ method: 'POST' }));
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get('video')).toBe(file);
    expect((request.body as FormData).get('targetFps')).toBe('15');
  });

  it('reads a completed job including its download URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'job-1', status: 'complete', progress: 100, targetFps: 15, outputName: 'clip_15fps.mp4',
      downloadUrl: '/api/video-frame-extraction/job-1/download'
    }))));

    const job = await getVideoFrameExtraction('job-1');

    expect(job.downloadUrl).toBe('/api/video-frame-extraction/job-1/download');
  });
});
