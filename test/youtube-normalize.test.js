import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeYoutubeUrl } from '../src/providers/youtube.js';

test('normalizeYoutubeUrl normalizes youtu.be share links', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://youtu.be/dQw4w9WgXcQ'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  );
});

test('normalizeYoutubeUrl preserves query params (t/start/si/etc)', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://youtu.be/dQw4w9WgXcQ?t=43'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43',
  );
});

test('normalizeYoutubeUrl preserves hash timestamps (youtu.be)', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://youtu.be/dQw4w9WgXcQ#t=1m2s'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m2s',
  );
});

test('normalizeYoutubeUrl preserves hash timestamps (watch URL)', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ#t=62'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=62',
  );
});

test('normalizeYoutubeUrl normalizes shorts URLs', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  );
});

test('normalizeYoutubeUrl normalizes handle-based shorts URLs', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://www.youtube.com/@RickAstley/shorts/dQw4w9WgXcQ?feature=share'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
  );
});

test('normalizeYoutubeUrl normalizes live URLs', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://www.youtube.com/live/dQw4w9WgXcQ?si=abc'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=abc',
  );
});

test('normalizeYoutubeUrl normalizes handle-based live URLs', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://www.youtube.com/@SomeChannel/live/dQw4w9WgXcQ#t=62'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=62',
  );
});

test('normalizeYoutubeUrl normalizes embed URLs', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=10'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=10',
  );
});

test('normalizeYoutubeUrl normalizes /v/ URLs', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://www.youtube.com/v/dQw4w9WgXcQ?start=10'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=10',
  );
});

test('normalizeYoutubeUrl normalizes attribution_link share URLs', () => {
  assert.strictEqual(
    normalizeYoutubeUrl(
      'https://www.youtube.com/attribution_link?u=%2Fwatch%3Fv%3DdQw4w9WgXcQ%26t%3D30s%26feature%3Dshare',
    ),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&feature=share',
  );
});

test('normalizeYoutubeUrl canonicalizes subdomain watch URLs to www.youtube.com', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=43'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43',
  );
});

test('normalizeYoutubeUrl canonicalizes music.youtube.com to www.youtube.com', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
  );
});

test('normalizeYoutubeUrl does not normalize non-video youtu.be paths', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://youtu.be/channel/UC38IQsAvIsxxjztdMZQtwHA'),
    'https://youtu.be/channel/UC38IQsAvIsxxjztdMZQtwHA',
  );
});

test('normalizeYoutubeUrl does not normalize shorts URLs without a valid 11-char video id', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://www.youtube.com/shorts/not-a-video-id'),
    'https://www.youtube.com/shorts/not-a-video-id',
  );
});
