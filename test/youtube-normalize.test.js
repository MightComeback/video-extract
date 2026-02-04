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

test('normalizeYoutubeUrl normalizes shorts URLs', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  );
});

test('normalizeYoutubeUrl normalizes live URLs', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://www.youtube.com/live/dQw4w9WgXcQ?si=abc'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=abc',
  );
});

test('normalizeYoutubeUrl normalizes embed URLs', () => {
  assert.strictEqual(
    normalizeYoutubeUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=10'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=10',
  );
});
