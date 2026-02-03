import { test, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import ytdl from 'ytdl-core';
import { extractFromUrl } from '../src/extractor.js';
import { fetchYoutubeMediaUrl } from '../src/providers/youtube.js';

function loadFixture(name) {
  const p = path.join(process.cwd(), 'test', 'fixtures', name);
  return fs.readFileSync(p, 'utf8');
}

function mkResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(body, { status, headers });
}

test('extractFromUrl uses ytdl-core as a fallback to resolve YouTube mediaUrl', async (t) => {
  const youtubeHtml = loadFixture('youtube-watch.html');

  // Mock ytdl calls so we never hit the network.
  mock.method(ytdl, 'getInfo', async () => ({ formats: [] }));
  mock.method(ytdl, 'chooseFormat', () => ({ url: 'https://example.com/video.mp4' }));

  // Sanity: our ytdl mocks should affect the provider helper directly.
  const direct = await fetchYoutubeMediaUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(direct, 'https://example.com/video.mp4');

  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    const method = String(init?.method || 'GET').toUpperCase();

    if (method === 'HEAD') return mkResponse('', { status: 405 });

    if (/^https:\/\/(?:www\.)?youtube\.com\/watch\b/i.test(url)) {
      return mkResponse(youtubeHtml, { status: 200, headers: { 'content-type': 'text/html' } });
    }

    // We don't need captions for this test; just return 404 for everything else.
    return mkResponse('not found', { status: 404 });
  };

  const res = await extractFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { noDownload: true, noSplit: true });
  assert.equal(res.ok, true);
  assert.equal(res.mediaUrl, 'https://example.com/video.mp4');
});
