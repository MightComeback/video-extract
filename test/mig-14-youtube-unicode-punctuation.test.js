import { test, expect } from 'bun:test';

import { extractYoutubeId, normalizeYoutubeUrl } from '../src/providers/youtube.js';

test('MIG-14: YouTube URL helpers tolerate unicode trailing punctuation and wrappers', () => {
  const id = 'dQw4w9WgXcQ';

  // Common chat copy/paste variants
  expect(extractYoutubeId(`“https://youtu.be/${id}?t=43”`)).toBe(id);
  expect(extractYoutubeId(`«https://www.youtube.com/watch?v=${id}&t=43»`)).toBe(id);
  expect(extractYoutubeId(`https://youtu.be/${id}?t=43…。`)).toBe(id);
  expect(extractYoutubeId(`(https://youtu.be/${id}?t=43)）`)).toBe(id);

  // Also ensure normalization keeps the timestamp.
  expect(normalizeYoutubeUrl(`«https://youtu.be/${id}#t=1m2s»`)).toBe(`https://youtube.com/watch?v=${id}&t=1m2s`);
});
