import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeLoomUrl } from '../src/providers/loom.js';

test('normalizeLoomUrl canonicalizes common Loom URL shapes', () => {
  assert.strictEqual(
    normalizeLoomUrl('https://www.loom.com/share/1234567890abcdef'),
    'https://www.loom.com/share/1234567890abcdef'
  );

  // share.loom.com -> www.loom.com
  assert.strictEqual(
    normalizeLoomUrl('https://share.loom.com/share/1234567890abcdef'),
    'https://www.loom.com/share/1234567890abcdef'
  );

  // bare loom.com/<id> -> /share/<id>
  assert.strictEqual(
    normalizeLoomUrl('https://loom.com/1234567890abcdef'),
    'https://www.loom.com/share/1234567890abcdef'
  );

  // /v and /embed should normalize to /share
  assert.strictEqual(
    normalizeLoomUrl('https://www.loom.com/v/1234567890abcdef'),
    'https://www.loom.com/share/1234567890abcdef'
  );
  assert.strictEqual(
    normalizeLoomUrl('https://www.loom.com/embed/1234567890abcdef'),
    'https://www.loom.com/share/1234567890abcdef'
  );
});

test('normalizeLoomUrl preserves sid for private links', () => {
  assert.strictEqual(
    normalizeLoomUrl('https://www.loom.com/share/1234567890abcdef?sid=xyz'),
    'https://www.loom.com/share/1234567890abcdef?sid=xyz'
  );

  assert.strictEqual(
    normalizeLoomUrl('https://share.loom.com/share/1234567890abcdef?sid=xyz'),
    'https://www.loom.com/share/1234567890abcdef?sid=xyz'
  );
});
