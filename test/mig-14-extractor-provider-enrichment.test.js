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
  assert.equal(res.text, 'Hello Vimeo');
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
  assert.equal(res.text, 'Hello again');
});
