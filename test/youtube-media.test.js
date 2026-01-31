import { test, mock } from 'node:test';
import assert from 'node:assert';
import { fetchYoutubeMediaUrl } from '../src/providers/youtube.js';
import ytdl from 'ytdl-core';

test('fetchYoutubeMediaUrl returns URL when format found', async () => {
    // Mock ytdl.getInfo and chooseFormat
    const mockInfo = { formats: [] };
    const mockFormat = { url: 'https://video.url/file.mp4' };

    // Create a mock for getInfo
    const getInfoMock = mock.method(ytdl, 'getInfo', async () => mockInfo);
    // Create a mock for chooseFormat
    const chooseFormatMock = mock.method(ytdl, 'chooseFormat', () => mockFormat);

    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const result = await fetchYoutubeMediaUrl(url);

    assert.strictEqual(result, 'https://video.url/file.mp4');
    assert.strictEqual(getInfoMock.mock.calls.length, 1);
    assert.strictEqual(chooseFormatMock.mock.calls.length, 1);
});

test('fetchYoutubeMediaUrl returns null on error', async () => {
    // We can't easily restore the previous mock if restore() is missing,
    // but we can re-mock or just ignore if the order is safe.
    // However, if getInfoMock persisted, we need to override it.
    
    // Let's rely on the timestamp or different url to differentiate if needed,
    // but here we just want it to throw.
    // Since we cannot restore, we are stuck with the previous mock if we don't fix this.
    
    // Actually, let's just create a fresh mock behavior by defining the method again?
    // Multiple mocks on same method? Node test runner might stack them or replace.
    
    const getInfoMock2 = mock.method(ytdl, 'getInfo', async () => {
        throw new Error('Video unavailable');
    });

    const url = 'https://www.youtube.com/watch?v=broken';
    const result = await fetchYoutubeMediaUrl(url);

    assert.strictEqual(result, null);
    assert.strictEqual(getInfoMock2.mock.calls.length, 1);
});
