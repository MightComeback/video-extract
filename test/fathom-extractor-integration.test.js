import { test } from 'node:test';
import assert from 'node:assert';

import { extractFromUrl } from '../src/extractor.js';

function mkResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(body, { status, headers });
}

test('extractFromUrl enriches Fathom metadata from HTML (provider parity)', async (t) => {
  const fathomHtml = `
    <html>
      <head>
        <meta property="og:title" content="Fathom Test Recording">
        <script>
          window.__DATA__ = {
            "downloadUrl": "https://cdn.fathom.video/test.mp4?token=abc"
          };
        </script>
      </head>
      <body>Some page content</body>
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

    if (/^https:\/\/fathom\.video\/share\//i.test(url)) {
      return mkResponse(fathomHtml, { status: 200, headers: { 'content-type': 'text/html' } });
    }

    return mkResponse('not found', { status: 404 });
  };

  const res = await extractFromUrl('https://fathom.video/share/test123', { noDownload: true, noSplit: true });
  assert.equal(res.ok, true);
  assert.equal(res.title, 'Fathom Test Recording');
  assert.ok(res.mediaUrl?.includes('cdn.fathom.video/test.mp4'), 'Should extract mediaUrl from Fathom HTML');
});

test('extractFromUrl uses Fathom copy_transcript endpoint when available', async (t) => {
  const fathomHtml = `
    <html>
      <head>
        <meta property="og:title" content="Fathom With Transcript">
        <script>
          window.__DATA__ = {
            "copyTranscriptUrl": "https://api.fathom.video/share/abc123/copy_transcript"
          };
        </script>
      </head>
    </html>
  `;

  const transcriptJson = JSON.stringify({
    html: '<p>00:00 Speaker: Hello from Fathom transcript</p><p>00:05 Speaker: Second line</p>'
  });

  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    const method = String(init?.method || 'GET').toUpperCase();

    if (method === 'HEAD') return mkResponse('', { status: 405 });

    if (/^https:\/\/fathom\.video\/share\//i.test(url)) {
      return mkResponse(fathomHtml, { status: 200, headers: { 'content-type': 'text/html' } });
    }

    if (url.includes('copy_transcript')) {
      return mkResponse(transcriptJson, { status: 200, headers: { 'content-type': 'application/json' } });
    }

    return mkResponse('not found', { status: 404 });
  };

  const res = await extractFromUrl('https://fathom.video/share/abc123', { noDownload: true, noSplit: true });
  assert.equal(res.ok, true);
  assert.equal(res.title, 'Fathom With Transcript');
  assert.ok(res.text?.includes('Hello from Fathom transcript'), 'Should extract transcript from copy_transcript endpoint');
});
