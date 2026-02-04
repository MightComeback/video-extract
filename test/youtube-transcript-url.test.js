import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractYoutubeTranscriptUrl } from '../src/providers/youtube.js';

test('extractYoutubeTranscriptUrl: extracts VTT transcript URL from ytInitialPlayerResponse', () => {
  const mockData = {
    videoDetails: { title: 'Test Video' },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            baseUrl: 'https://www.youtube.com/api/timedtext?v=abc123&lang=en',
            name: { simpleText: 'English' },
            languageCode: 'en',
            kind: 'standard'
          }
        ]
      }
    }
  };

  const html = `<script>var ytInitialPlayerResponse = ${JSON.stringify(mockData)};</script>`;
  const url = extractYoutubeTranscriptUrl(html);
  assert.ok(url);
  assert.ok(url.includes('fmt=vtt'));
  assert.ok(url.startsWith('https://www.youtube.com/api/timedtext'));
});

test('extractYoutubeTranscriptUrl: prefers English captions', () => {
  const mockData = {
    videoDetails: { title: 'Test' },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            baseUrl: 'https://www.youtube.com/api/timedtext?v=abc&lang=es',
            languageCode: 'es',
            kind: 'standard'
          },
          {
            baseUrl: 'https://www.youtube.com/api/timedtext?v=abc&lang=en',
            languageCode: 'en',
            kind: 'standard'
          }
        ]
      }
    }
  };

  const html = `<script>var ytInitialPlayerResponse = ${JSON.stringify(mockData)};</script>`;
  const url = extractYoutubeTranscriptUrl(html);
  assert.ok(url?.includes('lang=en'));
});

test('extractYoutubeTranscriptUrl: prefers non-ASR (manual) captions over auto-generated', () => {
  const mockData = {
    videoDetails: { title: 'Test' },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            baseUrl: 'https://www.youtube.com/api/timedtext?v=abc&lang=en&kind=asr',
            languageCode: 'en',
            kind: 'asr'
          },
          {
            baseUrl: 'https://www.youtube.com/api/timedtext?v=abc&lang=en',
            languageCode: 'en',
            kind: 'standard'
          }
        ]
      }
    }
  };

  const html = `<script>var ytInitialPlayerResponse = ${JSON.stringify(mockData)};</script>`;
  const url = extractYoutubeTranscriptUrl(html);
  // Should prefer the standard (manual) caption
  assert.ok(url);
  assert.ok(!url.includes('kind=asr'));
});

test('extractYoutubeTranscriptUrl: returns null when no captions available', () => {
  const mockData = {
    videoDetails: { title: 'No Captions' },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: []
      }
    }
  };

  const html = `<script>var ytInitialPlayerResponse = ${JSON.stringify(mockData)};</script>`;
  const url = extractYoutubeTranscriptUrl(html);
  assert.equal(url, null);
});

test('extractYoutubeTranscriptUrl: returns null when captions object missing', () => {
  const mockData = {
    videoDetails: { title: 'No Captions' }
  };

  const html = `<script>var ytInitialPlayerResponse = ${JSON.stringify(mockData)};</script>`;
  const url = extractYoutubeTranscriptUrl(html);
  assert.equal(url, null);
});

test('extractYoutubeTranscriptUrl: handles window["ytInitialPlayerResponse"] assignment', () => {
  const mockData = {
    videoDetails: { title: 'Window Assignment' },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            baseUrl: 'https://www.youtube.com/api/timedtext?v=abc&lang=en',
            languageCode: 'en'
          }
        ]
      }
    }
  };

  const html = `<script>window["ytInitialPlayerResponse"] = ${JSON.stringify(mockData)};</script>`;
  const url = extractYoutubeTranscriptUrl(html);
  assert.ok(url);
  assert.ok(url.includes('fmt=vtt'));
});

test('extractYoutubeTranscriptUrl: returns null for empty HTML', () => {
  assert.equal(extractYoutubeTranscriptUrl(''), null);
  assert.equal(extractYoutubeTranscriptUrl(null), null);
  assert.equal(extractYoutubeTranscriptUrl(undefined), null);
});

test('extractYoutubeTranscriptUrl: returns null for HTML without ytInitialPlayerResponse', () => {
  const html = '<html><body>No script here</body></html>';
  assert.equal(extractYoutubeTranscriptUrl(html), null);
});
