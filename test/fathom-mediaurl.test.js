import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchFathomMediaUrl, extractFathomMetadataFromHtml } from '../src/providers/fathom.js';

test('fetchFathomMediaUrl extracts media URL from Fathom page HTML', async () => {
  const originalFetch = globalThis.fetch;

  try {
    const mockHtml = `
      <html>
        <head>
          <meta property="og:title" content="Test Fathom Recording">
        </head>
        <script>
          window.__DATA__ = {
            "downloadUrl": "https://cdn.fathom.video/recording.mp4?token=abc123"
          };
        </script>
      </html>
    `;

    globalThis.fetch = async (url) => {
      return {
        ok: true,
        text: async () => mockHtml,
      };
    };

    const mediaUrl = await fetchFathomMediaUrl('https://fathom.video/share/test123');
    assert.equal(mediaUrl, 'https://cdn.fathom.video/recording.mp4?token=abc123');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchFathomMediaUrl falls back to mediaUrl when downloadUrl not present', async () => {
  const originalFetch = globalThis.fetch;

  try {
    const mockHtml = `
      <html>
        <head>
          <meta property="og:title" content="Test Fathom Recording">
        </head>
        <script>
          window.__DATA__ = {
            "mediaUrl": "https://cdn.fathom.video/video.mp4"
          };
        </script>
      </html>
    `;

    globalThis.fetch = async (url) => {
      return {
        ok: true,
        text: async () => mockHtml,
      };
    };

    const mediaUrl = await fetchFathomMediaUrl('https://fathom.video/share/test123');
    assert.equal(mediaUrl, 'https://cdn.fathom.video/video.mp4');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchFathomMediaUrl prefers downloadUrl over mediaUrl', async () => {
  const originalFetch = globalThis.fetch;

  try {
    const mockHtml = `
      <html>
        <head>
          <meta property="og:title" content="Test Fathom Recording">
        </head>
        <script>
          window.__DATA__ = {
            "downloadUrl": "https://cdn.fathom.video/download.mp4",
            "mediaUrl": "https://cdn.fathom.video/stream.mp4"
          };
        </script>
      </html>
    `;

    globalThis.fetch = async (url) => {
      return {
        ok: true,
        text: async () => mockHtml,
      };
    };

    const mediaUrl = await fetchFathomMediaUrl('https://fathom.video/share/test123');
    // Should prefer downloadUrl (first in the keys list)
    assert.equal(mediaUrl, 'https://cdn.fathom.video/download.mp4');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchFathomMediaUrl returns null for non-Fathom URLs', async () => {
  const mediaUrl = await fetchFathomMediaUrl('https://google.com');
  assert.equal(mediaUrl, null);
});

test('fetchFathomMediaUrl returns null on network error', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => {
      throw new Error('Network error');
    };

    const mediaUrl = await fetchFathomMediaUrl('https://fathom.video/share/test123');
    assert.equal(mediaUrl, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchFathomMediaUrl returns null when no media URL found', async () => {
  const originalFetch = globalThis.fetch;

  try {
    const mockHtml = '<html><body>No video here</body></html>';

    globalThis.fetch = async (url) => {
      return {
        ok: true,
        text: async () => mockHtml,
      };
    };

    const mediaUrl = await fetchFathomMediaUrl('https://fathom.video/share/test123');
    assert.equal(mediaUrl, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchFathomMediaUrl normalizes input URL before fetching', async () => {
  const originalFetch = globalThis.fetch;
  let fetchedUrl = null;

  try {
    const mockHtml = `
      <html>
        <head>
          <meta property="og:title" content="Test">
        </head>
        <script>
          window.__DATA__ = {
            "downloadUrl": "https://cdn.fathom.video/video.mp4"
          };
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

    await fetchFathomMediaUrl('fathom.video/share/test123');
    // Should normalize to https://fathom.video/share/test123
    assert.ok(fetchedUrl.startsWith('https://'));
    assert.ok(fetchedUrl.includes('fathom.video/share/test123'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchFathomMediaUrl preserves deep-link timestamps in normalized URL', async () => {
  const originalFetch = globalThis.fetch;
  let fetchedUrl = null;

  try {
    const mockHtml = `
      <html>
        <head>
          <meta property="og:title" content="Test">
        </head>
        <script>
          window.__DATA__ = {
            "downloadUrl": "https://cdn.fathom.video/video.mp4"
          };
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

    await fetchFathomMediaUrl('https://fathom.video/share/test123?t=120');
    // Should preserve the t parameter in the normalized URL
    assert.ok(fetchedUrl.includes('t=120'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchFathomMediaUrl handles escaped JSON URLs', async () => {
  const originalFetch = globalThis.fetch;

  try {
    const mockHtml = `
      <html>
        <head>
          <meta property="og:title" content="Test">
        </head>
        <script>
          window.__DATA__ = {
            "downloadUrl": "https:\/\/cdn.fathom.video\/escaped.mp4?token=xyz"
          };
        </script>
      </html>
    `;

    globalThis.fetch = async (url) => {
      return {
        ok: true,
        text: async () => mockHtml,
      };
    };

    const mediaUrl = await fetchFathomMediaUrl('https://fathom.video/share/test123');
    assert.equal(mediaUrl, 'https://cdn.fathom.video/escaped.mp4?token=xyz');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchFathomMediaUrl handles protocol-relative URLs', async () => {
  const originalFetch = globalThis.fetch;

  try {
    const mockHtml = `
      <html>
        <head>
          <meta property="og:title" content="Test">
        </head>
        <script>
          window.__DATA__ = {
            "downloadUrl": "//cdn.fathom.video/video.mp4"
          };
        </script>
      </html>
    `;

    globalThis.fetch = async (url) => {
      return {
        ok: true,
        text: async () => mockHtml,
      };
    };

    const mediaUrl = await fetchFathomMediaUrl('https://fathom.video/share/test123');
    assert.equal(mediaUrl, 'https://cdn.fathom.video/video.mp4');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchFathomMediaUrl returns null on HTTP error response', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => {
      return {
        ok: false,
        status: 404,
        text: async () => 'Not found',
      };
    };

    const mediaUrl = await fetchFathomMediaUrl('https://fathom.video/share/test123');
    assert.equal(mediaUrl, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
