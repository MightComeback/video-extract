import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchVimeoMediaUrl } from '../src/providers/vimeo.js';

test('fetchVimeoMediaUrl extracts media URL from Vimeo page HTML', async () => {
  const originalFetch = globalThis.fetch;

  try {
    const mockHtml = `
      <html>
        <script>
          var clip_page_config = ${JSON.stringify({
            clip: {
              name: 'Test Video',
              duration: { raw: 120 },
              poster: { display_src: 'https://i.vimeocdn.com/poster.jpg' },
            },
            owner: { display_name: 'Test Author' },
            request: {
              files: {
                progressive: [
                  { url: 'https://cdn.vimeo.com/video.mp4', width: 1920, height: 1080 },
                ],
              },
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

    const mediaUrl = await fetchVimeoMediaUrl('https://vimeo.com/123456789');
    assert.equal(mediaUrl, 'https://cdn.vimeo.com/video.mp4');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchVimeoMediaUrl falls back to HLS when no progressive MP4', async () => {
  const originalFetch = globalThis.fetch;

  try {
    const mockHtml = `
      <html>
        <script>
          var clip_page_config = ${JSON.stringify({
            clip: { name: 'Test Video' },
            request: {
              files: {
                progressive: [],
                hls: {
                  default_cdn: 'akamai',
                  cdns: {
                    akamai: { url: 'https://cdn.vimeo.com/hls/master.m3u8' },
                  },
                },
              },
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

    const mediaUrl = await fetchVimeoMediaUrl('https://vimeo.com/123456789');
    assert.equal(mediaUrl, 'https://cdn.vimeo.com/hls/master.m3u8');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchVimeoMediaUrl returns null for non-Vimeo URLs', async () => {
  const mediaUrl = await fetchVimeoMediaUrl('https://google.com');
  assert.equal(mediaUrl, null);
});

test('fetchVimeoMediaUrl returns null on network error', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => {
      throw new Error('Network error');
    };

    const mediaUrl = await fetchVimeoMediaUrl('https://vimeo.com/123456789');
    assert.equal(mediaUrl, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchVimeoMediaUrl returns null when no media URL found', async () => {
  const originalFetch = globalThis.fetch;

  try {
    const mockHtml = '<html><body>No video here</body></html>';

    globalThis.fetch = async (url) => {
      return {
        ok: true,
        text: async () => mockHtml,
      };
    };

    const mediaUrl = await fetchVimeoMediaUrl('https://vimeo.com/123456789');
    assert.equal(mediaUrl, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchVimeoMediaUrl normalizes input URL before fetching', async () => {
  const originalFetch = globalThis.fetch;
  let fetchedUrl = null;

  try {
    const mockHtml = `
      <html>
        <script>
          var clip_page_config = ${JSON.stringify({
            clip: { name: 'Test Video' },
            request: {
              files: {
                progressive: [{ url: 'https://cdn.vimeo.com/video.mp4', width: 1920 }],
              },
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

    await fetchVimeoMediaUrl('https://player.vimeo.com/video/123456789');
    // Should normalize to canonical vimeo.com URL
    assert.ok(fetchedUrl.includes('vimeo.com/'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchVimeoMediaUrl preserves unlisted hash in normalized URL', async () => {
  const originalFetch = globalThis.fetch;
  let fetchedUrl = null;

  try {
    const mockHtml = `
      <html>
        <script>
          var clip_page_config = ${JSON.stringify({
            clip: { name: 'Test Video' },
            request: {
              files: {
                progressive: [{ url: 'https://cdn.vimeo.com/video.mp4', width: 1920 }],
              },
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

    await fetchVimeoMediaUrl('https://vimeo.com/123456789/abcdef123');
    // Should include the hash parameter
    assert.ok(fetchedUrl.includes('h='));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
