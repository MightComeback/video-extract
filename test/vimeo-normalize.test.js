import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeVimeoUrl } from '../src/providers/vimeo.js';

test('normalizeVimeoUrl canonicalizes common Vimeo URL shapes', () => {
  assert.equal(normalizeVimeoUrl('https://player.vimeo.com/video/12345'), 'https://vimeo.com/12345');
  assert.equal(normalizeVimeoUrl('https://vimeo.com/manage/videos/123456789'), 'https://vimeo.com/123456789');
  assert.equal(normalizeVimeoUrl('https://vimeo.com/123456789/abcdef1234'), 'https://vimeo.com/123456789?h=abcdef1234');
  assert.equal(
    normalizeVimeoUrl('https://vimeo.com/123456789/review/abcdef123456/abcdef1234'),
    'https://vimeo.com/123456789/review/abcdef123456/abcdef1234?h=abcdef1234'
  );
});

test('normalizeVimeoUrl preserves showcase context when present', () => {
  assert.equal(
    normalizeVimeoUrl('https://vimeo.com/showcase/9999999/video/123456789'),
    'https://vimeo.com/showcase/9999999/video/123456789'
  );

  assert.equal(
    normalizeVimeoUrl('https://vimeo.com/showcase/9999999/video/123456789?h=abcdef1234&t=30'),
    'https://vimeo.com/showcase/9999999/video/123456789?h=abcdef1234&t=30'
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

test('normalizeVimeoUrl tolerates chat wrappers and punctuation (provider parity)', () => {
  // Slack-style <url|label>
  assert.equal(
    normalizeVimeoUrl('<https://vimeo.com/123456789/abcdef1234|Vimeo>'),
    'https://vimeo.com/123456789?h=abcdef1234'
  );

  // Angle-wrapped
  assert.equal(
    normalizeVimeoUrl('<https://player.vimeo.com/video/12345>'),
    'https://vimeo.com/12345'
  );

  // Trailing punctuation / parentheses (common in prose)
  assert.equal(
    normalizeVimeoUrl('(https://vimeo.com/123456789/abcdef1234#t=30s).'),
    'https://vimeo.com/123456789?h=abcdef1234&t=30s'
  );

  // HTML entity escapes in query params
  assert.equal(
    normalizeVimeoUrl('https://vimeo.com/123456789/abcdef1234?h=abcdef1234&amp;t=90'),
    'https://vimeo.com/123456789?h=abcdef1234&t=90'
  );
});
