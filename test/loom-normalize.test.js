import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeLoomUrl } from '../src/providers/loom.js';

test('normalizeLoomUrl canonicalizes common Loom URL shapes', () => {
  assert.strictEqual(
    normalizeLoomUrl('https://www.loom.com/share/1234567890abcdef'),
    'https://loom.com/share/1234567890abcdef'
  );

  // share.loom.com -> loom.com
  assert.strictEqual(
    normalizeLoomUrl('https://share.loom.com/share/1234567890abcdef'),
    'https://loom.com/share/1234567890abcdef'
  );

  // Provider parity: useloom.com -> loom.com
  assert.strictEqual(
    normalizeLoomUrl('https://www.useloom.com/share/1234567890abcdef'),
    'https://loom.com/share/1234567890abcdef'
  );
  assert.strictEqual(
    normalizeLoomUrl('https://share.useloom.com/share/1234567890abcdef'),
    'https://loom.com/share/1234567890abcdef'
  );

  // bare loom.com/<id> -> /share/<id>
  assert.strictEqual(
    normalizeLoomUrl('https://loom.com/1234567890abcdef'),
    'https://loom.com/share/1234567890abcdef'
  );

  // /v and /embed should normalize to /share
  assert.strictEqual(
    normalizeLoomUrl('https://www.loom.com/v/1234567890abcdef'),
    'https://loom.com/share/1234567890abcdef'
  );
  assert.strictEqual(
    normalizeLoomUrl('https://www.loom.com/embed/1234567890abcdef'),
    'https://loom.com/share/1234567890abcdef'
  );
});

test('normalizeLoomUrl preserves sid for private links', () => {
  assert.strictEqual(
    normalizeLoomUrl('https://www.loom.com/share/1234567890abcdef?sid=xyz'),
    'https://loom.com/share/1234567890abcdef?sid=xyz'
  );

  assert.strictEqual(
    normalizeLoomUrl('https://share.loom.com/share/1234567890abcdef?sid=xyz'),
    'https://loom.com/share/1234567890abcdef?sid=xyz'
  );

  assert.strictEqual(
    normalizeLoomUrl('https://share.useloom.com/share/1234567890abcdef?sid=xyz'),
    'https://loom.com/share/1234567890abcdef?sid=xyz'
  );
});

test('normalizeLoomUrl drops tracking params but preserves deep-link timestamps', () => {
  assert.strictEqual(
    normalizeLoomUrl('https://www.loom.com/share/1234567890abcdef?sid=xyz&utm_source=foo&t=30s'),
    'https://loom.com/share/1234567890abcdef?sid=xyz&t=30s'
  );

  // Hash deep-links should also be preserved.
  assert.strictEqual(
    normalizeLoomUrl('https://www.loom.com/share/1234567890abcdef?utm_medium=bar#t=45'),
    'https://loom.com/share/1234567890abcdef?t=45'
  );
});

test('normalizeLoomUrl tolerates chat wrappers and punctuation (provider parity)', () => {
  // Slack-style <url|label>
  assert.strictEqual(
    normalizeLoomUrl('<https://www.loom.com/share/1234567890abcdef|Loom>'),
    'https://loom.com/share/1234567890abcdef'
  );

  // Angle-wrapped
  assert.strictEqual(
    normalizeLoomUrl('<https://share.loom.com/share/1234567890abcdef?sid=xyz>'),
    'https://loom.com/share/1234567890abcdef?sid=xyz'
  );

  // Trailing punctuation / parentheses
  assert.strictEqual(
    normalizeLoomUrl('(https://www.loom.com/share/1234567890abcdef?utm_source=a#t=45).'),
    'https://loom.com/share/1234567890abcdef?t=45'
  );

  // HTML entity escapes
  assert.strictEqual(
    normalizeLoomUrl('https://www.loom.com/share/1234567890abcdef?sid=xyz&amp;t=30s'),
    'https://loom.com/share/1234567890abcdef?sid=xyz&t=30s'
  );
});
