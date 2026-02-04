import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchLoomMediaUrl, extractLoomMetadataFromHtml } from '../src/providers/loom.js';

test('fetchLoomMediaUrl extracts media URL from Loom page HTML', async () => {
  const originalFetch = globalThis.fetch;

  try {
    const mockHtml = `
      <html>
        <script>
          window.__APOLLO_STATE__ = ${JSON.stringify({
            'RegularUserVideo:abc123': {
              id: 'abc123',
              name: 'Test Video',
              nullableRawCdnUrlMP4: { url: 'https://cdn.loom.com/video.mp4' },
            },
          })};
        </script>
      </html>
    `;

    globalThis.fetch = async (url) => {
      return {
        ok: true,
        text: async () => mockHtml,
      };
    };

    const mediaUrl = await fetchLoomMediaUrl('https://loom.com/share/abc123');
    assert.equal(mediaUrl, 'https://cdn.loom.com/video.mp4');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchLoomMediaUrl returns null for non-Loom URLs', async () => {
  const mediaUrl = await fetchLoomMediaUrl('https://google.com');
  assert.equal(mediaUrl, null);
});

test('fetchLoomMediaUrl returns null on network error', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => {
      throw new Error('Network error');
    };

    const mediaUrl = await fetchLoomMediaUrl('https://loom.com/share/abc123');
    assert.equal(mediaUrl, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchLoomMediaUrl returns null when no media URL found', async () => {
  const originalFetch = globalThis.fetch;

  try {
    const mockHtml = '<html><body>No video here</body></html>';

    globalThis.fetch = async (url) => {
      return {
        ok: true,
        text: async () => mockHtml,
      };
    };

    const mediaUrl = await fetchLoomMediaUrl('https://loom.com/share/abc123');
    assert.equal(mediaUrl, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchLoomMediaUrl normalizes input URL before fetching', async () => {
  const originalFetch = globalThis.fetch;
  let fetchedUrl = null;

  try {
    const mockHtml = `
      <html>
        <script>
          window.__APOLLO_STATE__ = ${JSON.stringify({
            'RegularUserVideo:abc123': {
              id: 'abc123',
              name: 'Test Video',
              nullableRawCdnUrlMP4: { url: 'https://cdn.loom.com/video.mp4' },
            },
          })};
        </script>
      </html>
    `;

    globalThis.fetch = async (url) => {
      fetchedUrl = url;
      return {
        ok: true,
        text: async () => mockHtml,
      };
    };

    await fetchLoomMediaUrl('https://www.loom.com/v/abc123');
    // Should normalize to share URL
    assert.ok(fetchedUrl.includes('/share/'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
