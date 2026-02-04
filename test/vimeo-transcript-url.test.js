import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractVimeoTranscriptUrl } from '../src/providers/vimeo.js';

test('extractVimeoTranscriptUrl: extracts VTT transcript URL from clip_page_config', () => {
  const mockConfig = {
    clip: { name: 'Test Video', duration: { raw: 120 } },
    request: {
      text_tracks: [
        {
          url: 'https://example.vimeo.com/texttrack/123.vtt',
          lang: 'en',
          name: 'English'
        }
      ]
    }
  };

  const html = `<script>var clip_page_config = ${JSON.stringify(mockConfig)};</script>`;
  const url = extractVimeoTranscriptUrl(html);
  assert.equal(url, 'https://example.vimeo.com/texttrack/123.vtt');
});

test('extractVimeoTranscriptUrl: prefers English text tracks', () => {
  const mockConfig = {
    clip: { name: 'Test' },
    request: {
      text_tracks: [
        {
          url: 'https://example.vimeo.com/texttrack/es.vtt',
          lang: 'es',
          name: 'Español'
        },
        {
          url: 'https://example.vimeo.com/texttrack/en.vtt',
          lang: 'en',
          name: 'English'
        }
      ]
    }
  };

  const html = `<script>var clip_page_config = ${JSON.stringify(mockConfig)};</script>`;
  const url = extractVimeoTranscriptUrl(html);
  assert.ok(url?.includes('/en.vtt'));
});

test('extractVimeoTranscriptUrl: prefers direct VTT assets over texttrack endpoints', () => {
  const mockConfig = {
    clip: { name: 'Test' },
    request: {
      text_tracks: [
        {
          url: 'https://example.vimeo.com/texttrack/123?format=vtt',
          lang: 'en',
          name: 'English (auto)'
        },
        {
          url: 'https://example.vimeo.com/captions/123.vtt',
          lang: 'en',
          name: 'English'
        }
      ]
    }
  };

  const html = `<script>var clip_page_config = ${JSON.stringify(mockConfig)};</script>`;
  const url = extractVimeoTranscriptUrl(html);
  // Should prefer the direct .vtt asset
  assert.ok(url?.includes('.vtt'));
});

test('extractVimeoTranscriptUrl: returns null when no text tracks available', () => {
  const mockConfig = {
    clip: { name: 'No Captions' },
    request: { text_tracks: [] }
  };

  const html = `<script>var clip_page_config = ${JSON.stringify(mockConfig)};</script>`;
  const url = extractVimeoTranscriptUrl(html);
  assert.equal(url, null);
});

test('extractVimeoTranscriptUrl: returns null when text_tracks missing', () => {
  const mockConfig = {
    clip: { name: 'No Captions' },
    request: {}
  };

  const html = `<script>var clip_page_config = ${JSON.stringify(mockConfig)};</script>`;
  const url = extractVimeoTranscriptUrl(html);
  assert.equal(url, null);
});

test('extractVimeoTranscriptUrl: returns null when no clip_page_config', () => {
  const html = '<html><body>No config here</body></html>';
  assert.equal(extractVimeoTranscriptUrl(html), null);
});

test('extractVimeoTranscriptUrl: handles malformed clip_page_config gracefully', () => {
  const html = '<script>var clip_page_config = { invalid json };</script>';
  assert.equal(extractVimeoTranscriptUrl(html), null);
});

test('extractVimeoTranscriptUrl: prefers non-auto tracks over auto-generated', () => {
  const mockConfig = {
    clip: { name: 'Test' },
    request: {
      text_tracks: [
        {
          url: 'https://example.vimeo.com/texttrack/auto.vtt',
          lang: 'en',
          name: 'English (automatic)'
        },
        {
          url: 'https://example.vimeo.com/texttrack/manual.vtt',
          lang: 'en',
          name: 'English'
        }
      ]
    }
  };

  const html = `<script>var clip_page_config = ${JSON.stringify(mockConfig)};</script>`;
  const url = extractVimeoTranscriptUrl(html);
  // Should prefer the non-auto track
  assert.ok(url?.includes('manual.vtt'));
});

test('extractVimeoTranscriptUrl: falls back to any available track when no English', () => {
  const mockConfig = {
    clip: { name: 'Test' },
    request: {
      text_tracks: [
        {
          url: 'https://example.vimeo.com/texttrack/es.vtt',
          lang: 'es',
          name: 'Español'
        },
        {
          url: 'https://example.vimeo.com/texttrack/fr.vtt',
          lang: 'fr',
          name: 'Français'
        }
      ]
    }
  };

  const html = `<script>var clip_page_config = ${JSON.stringify(mockConfig)};</script>`;
  const url = extractVimeoTranscriptUrl(html);
  // Should fall back to first available
  assert.ok(url);
  assert.ok(url?.includes('.vtt'));
});

test('extractVimeoTranscriptUrl: handles protocol-relative URLs', () => {
  const mockConfig = {
    clip: { name: 'Test' },
    request: {
      text_tracks: [
        {
          url: '//example.vimeo.com/texttrack/123.vtt',
          lang: 'en',
          name: 'English'
        }
      ]
    }
  };

  const html = `<script>var clip_page_config = ${JSON.stringify(mockConfig)};</script>`;
  const url = extractVimeoTranscriptUrl(html);
  assert.equal(url, 'https://example.vimeo.com/texttrack/123.vtt');
});

test('extractVimeoTranscriptUrl: normalizes texttrack endpoints to VTT format', () => {
  const mockConfig = {
    clip: { name: 'Test' },
    request: {
      text_tracks: [
        {
          url: 'https://example.vimeo.com/texttrack/123',
          lang: 'en',
          name: 'English'
        }
      ]
    }
  };

  const html = `<script>var clip_page_config = ${JSON.stringify(mockConfig)};</script>`;
  const url = extractVimeoTranscriptUrl(html);
  // Should add format=vtt for texttrack endpoints
  assert.ok(url?.includes('format=vtt'));
});

test('extractVimeoTranscriptUrl: returns null for empty/invalid inputs', () => {
  assert.equal(extractVimeoTranscriptUrl(''), null);
  assert.equal(extractVimeoTranscriptUrl(null), null);
  assert.equal(extractVimeoTranscriptUrl(undefined), null);
});
