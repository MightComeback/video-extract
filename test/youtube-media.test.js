import { test } from 'node:test';
import assert from 'node:assert';
import { fetchYoutubeMediaUrl } from '../src/providers/youtube.js';
import ytdl from 'ytdl-core';

test('fetchYoutubeMediaUrl returns URL when format found', async () => {
  const originalGetInfo = ytdl.getInfo;
  const originalChooseFormat = ytdl.chooseFormat;

  let getInfoCalls = 0;
  let chooseFormatCalls = 0;

  try {
    // Mock ytdl.getInfo and chooseFormat
    const mockInfo = { formats: [] };
    const mockFormat = { url: 'https://video.url/file.mp4', container: 'mp4', hasVideo: true, hasAudio: true };

    ytdl.getInfo = async () => {
      getInfoCalls++;
      return mockInfo;
    };

    ytdl.chooseFormat = () => {
      chooseFormatCalls++;
      return mockFormat;
    };

    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const result = await fetchYoutubeMediaUrl(url);

    assert.strictEqual(result, 'https://video.url/file.mp4');
    assert.strictEqual(getInfoCalls, 1);
    assert.strictEqual(chooseFormatCalls, 1);
  } finally {
    ytdl.getInfo = originalGetInfo;
    ytdl.chooseFormat = originalChooseFormat;
  }
});

test('fetchYoutubeMediaUrl returns null on error', async () => {
  const originalGetInfo = ytdl.getInfo;

  let getInfoCalls = 0;

  try {
    ytdl.getInfo = async () => {
      getInfoCalls++;
      throw new Error('Video unavailable');
    };

    const url = 'https://www.youtube.com/watch?v=broken';
    const result = await fetchYoutubeMediaUrl(url);

    assert.strictEqual(result, null);
    assert.strictEqual(getInfoCalls, 1);
  } finally {
    ytdl.getInfo = originalGetInfo;
  }
});
