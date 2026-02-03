import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ytdl from 'ytdl-core';

import { extractFromUrl } from '../src/extractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
}

test('extractFromUrl preserves a helpful reason when YouTube mediaUrl cannot be resolved', async () => {
  const originalFetch = globalThis.fetch;
  const originalGetInfo = ytdl.getInfo;

  try {
    const youtubeHtml = loadFixture('youtube-watch.html');

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'text/html' },
      text: async () => youtubeHtml,
      body: { cancel: async () => {} },
    });

    // Force ytdl-core to fail so mediaUrl resolution returns null.
    ytdl.getInfo = async () => {
      throw new Error('blocked');
    };

    const r = await extractFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      noDownload: true,
    });

    assert.equal(r.ok, true);
    assert.equal(r.mediaUrl, '');
    assert.ok(
      String(r.mediaDownloadError || '').includes('Unable to resolve a downloadable YouTube media URL'),
      `Expected a helpful mediaDownloadError; got: ${r.mediaDownloadError}`
    );
  } finally {
    globalThis.fetch = originalFetch;
    ytdl.getInfo = originalGetInfo;
  }
});
