import { test } from 'node:test';
import assert from 'node:assert';
import { isYoutubeUrl, extractYoutubeId } from '../src/providers/youtube.js';

test('isYoutubeUrl detection', () => {
  const valid = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'http://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://youtube.com/v/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ'
  ];
  
  const invalid = [
    'https://google.com',
    'https://vimeo.com/123456',
    'Just text',
    '',
    null
  ];

  valid.forEach(url => {
    assert.strictEqual(isYoutubeUrl(url), true, `Should accept ${url}`);
  });

  invalid.forEach(url => {
    assert.strictEqual(isYoutubeUrl(url), false, `Should reject ${url}`);
  });
});

test('extractYoutubeId extraction', () => {
  const cases = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    // With extra params
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s', 'dQw4w9WgXcQ'],
  ];

  cases.forEach(([url, expected]) => {
    assert.strictEqual(extractYoutubeId(url), expected, `Failed to extract from ${url}`);
  });
});
