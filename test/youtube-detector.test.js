import { test } from 'node:test';
import assert from 'node:assert';
import { isYoutubeUrl, extractYoutubeId } from '../src/providers/youtube.js';

test('isYoutubeUrl identifies valid YouTube URLs', () => {
  assert.strictEqual(isYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
  assert.strictEqual(isYoutubeUrl('https://youtu.be/dQw4w9WgXcQ'), true);
  assert.strictEqual(isYoutubeUrl('https://youtube.com/embed/dQw4w9WgXcQ'), true);
  assert.strictEqual(isYoutubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ'), true);
  assert.strictEqual(isYoutubeUrl('https://www.youtube.com/live/dQw4w9WgXcQ'), true);
});

test('extractYoutubeId extracts ID correctly', () => {
  assert.strictEqual(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(extractYoutubeId('https://www.youtube.com/live/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});
