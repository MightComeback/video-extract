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

test('extractFromUrl uses ytdl-core as a fallback to resolve YouTube mediaUrl', async () => {
  const originalFetch = globalThis.fetch;
  const originalGetInfo = ytdl.getInfo;
  const originalChooseFormat = ytdl.chooseFormat;

  try {
    const youtubeHtml = loadFixture('youtube-watch.html');

    // Mock network: fetch the YouTube HTML, nothing else.
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'text/html' },
      text: async () => youtubeHtml,
      body: { cancel: async () => {} },
    });

    // Mock ytdl calls so we never hit the network.
    ytdl.getInfo = async () => ({ formats: [] });
    ytdl.chooseFormat = () => ({
      url: 'https://cdn.example.com/video.mp4',
      container: 'mp4',
      hasVideo: true,
      hasAudio: true,
    });

    const r = await extractFromUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      noDownload: true,
    });

    assert.equal(r.ok, true);
    assert.equal(r.mediaUrl, 'https://cdn.example.com/video.mp4');
  } finally {
    globalThis.fetch = originalFetch;
    ytdl.getInfo = originalGetInfo;
    ytdl.chooseFormat = originalChooseFormat;
  }
});
