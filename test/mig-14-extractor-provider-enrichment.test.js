import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import { extractFromUrl } from '../src/extractor.js';

function loadFixture(name) {
  const p = path.join(process.cwd(), 'test', 'fixtures', name);
  return fs.readFileSync(p, 'utf8');
}

function mkResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(body, { status, headers });
}

test('extractFromUrl prefers YouTube caption VTT over page body text when available', async (t) => {
  const youtubeHtml = loadFixture('youtube-watch.html');

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

    if (/timedtext/i.test(url) && /fmt=vtt/i.test(url)) {
      const vtt = `WEBVTT\n\n00:00.000 --> 00:01.000\nHello\n\n00:01.000 --> 00:02.000\nWorld\n`;
      return mkResponse(vtt, { status: 200, headers: { 'content-type': 'text/vtt' } });
    }

    return mkResponse('not found', { status: 404 });
  };

  const res = await extractFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { noDownload: true, noSplit: true });
  assert.equal(res.ok, true);
  assert.equal(res.text, 'Hello World');
});

test('extractFromUrl uses Loom captions_source_url VTT when present in Apollo state', async (t) => {
  const loomHtml = loadFixture('loom-fake.html');

  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    const method = String(init?.method || 'GET').toUpperCase();

    if (method === 'HEAD') return mkResponse('', { status: 405 });

    if (/^https:\/\/(?:www\.)?loom\.com\/share\//i.test(url)) {
      return mkResponse(loomHtml, { status: 200, headers: { 'content-type': 'text/html' } });
    }

    if (/cdn\.loom\.com\/captions\.vtt/i.test(url)) {
      const vtt = `WEBVTT\n\n00:00.000 --> 00:01.000\nLoom\n\n00:01.000 --> 00:02.000\nTranscript\n`;
      return mkResponse(vtt, { status: 200, headers: { 'content-type': 'text/vtt' } });
    }

    return mkResponse('not found', { status: 404 });
  };

  const res = await extractFromUrl('https://www.loom.com/share/abc123', { noDownload: true, noSplit: true });
  assert.equal(res.ok, true);
  assert.equal(res.text, 'Loom Transcript');
});

test('extractFromUrl parses Vimeo JSON text tracks (non-VTT) when provided', async (t) => {
  const mockConfig = {
    clip: { name: 'Vimeo JSON Transcript Test' },
    request: { text_tracks: [{ url: 'https://cdn.vimeo.com/subs.json', lang: 'en' }] },
  };

  const vimeoHtml = `
    <html>
      <script>
        window.vimeo = window.vimeo || {};
        window.vimeo.clip_page_config = ${JSON.stringify(mockConfig)};
      </script>
    </html>
  `;

  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    const method = String(init?.method || 'GET').toUpperCase();

    if (method === 'HEAD') return mkResponse('', { status: 405 });

    if (/^https:\/\/vimeo\.com\/123456789\b/i.test(url)) {
      return mkResponse(vimeoHtml, { status: 200, headers: { 'content-type': 'text/html' } });
    }

    if (/cdn\.vimeo\.com\/subs\.json/i.test(url)) {
      const json = JSON.stringify({
        transcript: [
          { start: 0, text: 'Hello' },
          { start: 1, text: 'Vimeo' },
        ],
      });
      return mkResponse(json, { status: 200, headers: { 'content-type': 'application/json' } });
    }

    return mkResponse('not found', { status: 404 });
  };

  const res = await extractFromUrl('https://vimeo.com/123456789', { noDownload: true, noSplit: true });
  assert.equal(res.ok, true);
  assert.equal(res.text, '0:00 Hello\n0:01 Vimeo');
});

test('extractFromUrl parses Vimeo JSON text tracks from cues[] shape', async (t) => {
  const mockConfig = {
    clip: { name: 'Vimeo Cues Transcript Test' },
    request: { text_tracks: [{ url: 'https://cdn.vimeo.com/cues.json', lang: 'en' }] },
  };

  const vimeoHtml = `
    <html>
      <script>
        window.vimeo = window.vimeo || {};
        window.vimeo.clip_page_config = ${JSON.stringify(mockConfig)};
      </script>
    </html>
  `;

  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    const method = String(init?.method || 'GET').toUpperCase();

    if (method === 'HEAD') return mkResponse('', { status: 405 });

    if (/^https:\/\/vimeo\.com\/999999999\b/i.test(url)) {
      return mkResponse(vimeoHtml, { status: 200, headers: { 'content-type': 'text/html' } });
    }

    if (/cdn\.vimeo\.com\/cues\.json/i.test(url)) {
      const json = JSON.stringify({
        cues: [
          { startTime: 0, text: 'Hello' },
          { startTime: 1, text: 'again' },
        ],
      });
      return mkResponse(json, { status: 200, headers: { 'content-type': 'application/json' } });
    }

    return mkResponse('not found', { status: 404 });
  };

  const res = await extractFromUrl('https://vimeo.com/999999999', { noDownload: true, noSplit: true });
  assert.equal(res.ok, true);
  assert.equal(res.text, '0:00 Hello\n0:01 again');
});

test('extractFromUrl parses Vimeo JSON text tracks with nested content.text fields', async (t) => {
  const mockConfig = {
    clip: { name: 'Vimeo Nested Transcript Test' },
    request: { text_tracks: [{ url: 'https://cdn.vimeo.com/nested.json', lang: 'en' }] },
  };

  const vimeoHtml = `
    <html>
      <script>
        window.vimeo = window.vimeo || {};
        window.vimeo.clip_page_config = ${JSON.stringify(mockConfig)};
      </script>
    </html>
  `;

  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    const method = String(init?.method || 'GET').toUpperCase();

    if (method === 'HEAD') return mkResponse('', { status: 405 });

    if (/^https:\/\/vimeo\.com\/888888888\b/i.test(url)) {
      return mkResponse(vimeoHtml, { status: 200, headers: { 'content-type': 'text/html' } });
    }

    if (/cdn\.vimeo\.com\/nested\.json/i.test(url)) {
      const json = JSON.stringify({
        entries: [
          { start: 0, content: { text: 'Hello' } },
          { start: 1, content: { text: 'nested' } },
        ],
      });
      return mkResponse(json, { status: 200, headers: { 'content-type': 'application/json' } });
    }

    return mkResponse('not found', { status: 404 });
  };

  const res = await extractFromUrl('https://vimeo.com/888888888', { noDownload: true, noSplit: true });
  assert.equal(res.ok, true);
  assert.equal(res.text, '0:00 Hello\n0:01 nested');
});

test('extractFromUrl sorts Vimeo JSON cues by start time when out of order', async (t) => {
  const mockConfig = {
    clip: { name: 'Vimeo Out-of-Order Cues Test' },
    request: { text_tracks: [{ url: 'https://cdn.vimeo.com/out-of-order.json', lang: 'en' }] },
  };

  const vimeoHtml = `
    <html>
      <script>
        window.vimeo = window.vimeo || {};
        window.vimeo.clip_page_config = ${JSON.stringify(mockConfig)};
      </script>
    </html>
  `;

  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    const method = String(init?.method || 'GET').toUpperCase();

    if (method === 'HEAD') return mkResponse('', { status: 405 });

    if (/^https:\/\/vimeo\.com\/777777777\b/i.test(url)) {
      return mkResponse(vimeoHtml, { status: 200, headers: { 'content-type': 'text/html' } });
    }

    if (/cdn\.vimeo\.com\/out-of-order\.json/i.test(url)) {
      const json = JSON.stringify({
        cues: [
          { startTime: 2, text: 'third' },
          { startTime: 0, text: 'first' },
          { startTime: 1, text: 'second' },
        ],
      });
      return mkResponse(json, { status: 200, headers: { 'content-type': 'application/json' } });
    }

    return mkResponse('not found', { status: 404 });
  };

  const res = await extractFromUrl('https://vimeo.com/777777777', { noDownload: true, noSplit: true });
  assert.equal(res.ok, true);
  assert.equal(res.text, '0:00 first\n0:01 second\n0:02 third');
});

test('extractFromUrl does not fail when Vimeo transcript fetch fails', async (t) => {
  const mockConfig = {
    clip: { name: 'Vimeo Transcript Fetch Failure Test' },
    request: { text_tracks: [{ url: 'https://cdn.vimeo.com/missing.json', lang: 'en' }] },
  };

  const vimeoHtml = `
    <html>
      <body>Fallback body text</body>
      <script>
        window.vimeo = window.vimeo || {};
        window.vimeo.clip_page_config = ${JSON.stringify(mockConfig)};
      </script>
    </html>
  `;

  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    const method = String(init?.method || 'GET').toUpperCase();

    if (method === 'HEAD') return mkResponse('', { status: 405 });

    if (/^https:\/\/vimeo\.com\/666666666\b/i.test(url)) {
      return mkResponse(vimeoHtml, { status: 200, headers: { 'content-type': 'text/html' } });
    }

    if (/cdn\.vimeo\.com\/missing\.json/i.test(url)) {
      return mkResponse('not found', { status: 404 });
    }

    return mkResponse('not found', { status: 404 });
  };

  const res = await extractFromUrl('https://vimeo.com/666666666', { noDownload: true, noSplit: true });
  assert.equal(res.ok, true);
  assert.match(res.text, /Fallback body text/);
});

test('extractFromUrl falls back to Vimeo oEmbed title when clip_page_config is missing', async (t) => {
  const vimeoHtml = `<html><body>no config</body></html>`;

  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    const method = String(init?.method || 'GET').toUpperCase();

    if (method === 'HEAD') return mkResponse('', { status: 405 });

    if (/^https:\/\/vimeo\.com\/555555555\b/i.test(url)) {
      return mkResponse(vimeoHtml, { status: 200, headers: { 'content-type': 'text/html' } });
    }

    if (/^https:\/\/vimeo\.com\/api\/oembed\.json\b/i.test(url)) {
      const o = JSON.stringify({ title: 'Vimeo oEmbed Title' });
      return mkResponse(o, { status: 200, headers: { 'content-type': 'application/json' } });
    }

    return mkResponse('not found', { status: 404 });
  };

  const res = await extractFromUrl('https://vimeo.com/555555555', { noDownload: true, noSplit: true });
  assert.equal(res.ok, true);
  assert.equal(res.title, 'Vimeo oEmbed Title');
});
