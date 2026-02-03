import { test } from 'node:test';
import assert from 'node:assert';
import { extractFromUrl } from '../src/extractor.js';

test('extractFromUrl resolves YouTube clip URLs to canonical watch URLs when possible', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = String(input || '');

      // Clip page: include a "videoId" payload.
      if (/\/clip\//i.test(url)) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'text/html' },
          text: async () => '<html><body>{"videoId":"dQw4w9WgXcQ"}</body></html>',
        };
      }

      // Watch page: minimal HTML is fine for this unit test (we only care about preflight behavior).
      if (/youtube\.com\/watch\?v=dQw4w9WgXcQ/i.test(url)) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'text/html' },
          text: async () => '<html><head><title>ok</title></head><body>hello</body></html>',
        };
      }

      // Anything else should not be fetched here.
      return {
        ok: false,
        status: 404,
        headers: { get: () => 'text/plain' },
        text: async () => 'not found',
      };
    };

    const res = await extractFromUrl('https://www.youtube.com/clip/UgkxyZKk3VwzExampleClipId', {
      noDownload: true,
      noSplit: true,
    });

    assert.equal(res.ok, true);
    assert.equal(res.sourceUrl, 'https://youtube.com/watch?v=dQw4w9WgXcQ');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
