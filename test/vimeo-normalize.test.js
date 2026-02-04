import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeVimeoUrl } from '../src/providers/vimeo.js';

test('normalizeVimeoUrl canonicalizes common Vimeo URL shapes', () => {
  assert.equal(normalizeVimeoUrl('https://player.vimeo.com/video/12345'), 'https://vimeo.com/12345');
  assert.equal(normalizeVimeoUrl('https://vimeo.com/manage/videos/123456789'), 'https://vimeo.com/123456789');
  assert.equal(normalizeVimeoUrl('https://vimeo.com/123456789/abcdef1234'), 'https://vimeo.com/123456789?h=abcdef1234');
  assert.equal(
    normalizeVimeoUrl('https://vimeo.com/123456789/review/abcdef123456/abcdef1234'),
    'https://vimeo.com/123456789?h=abcdef1234'
  );
});

test('normalizeVimeoUrl preserves unlisted hash and deep-link timestamps', () => {
  assert.equal(
    normalizeVimeoUrl('https://vimeo.com/123456789?h=abcdef1234&t=90'),
    'https://vimeo.com/123456789?h=abcdef1234&t=90'
  );

  // Hash fragment timestamps (#t=...) should be preserved as query params for parity.
  assert.equal(
    normalizeVimeoUrl('https://vimeo.com/123456789/abcdef1234#t=30s'),
    'https://vimeo.com/123456789?h=abcdef1234&t=30s'
  );
});
