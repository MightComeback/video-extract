import { test } from 'node:test';
import assert from 'node:assert';
import { extractFathomId, isFathomUrl } from '../src/providers/fathom.js';

test('isFathomUrl detects valid links', () => {
  assert.strictEqual(isFathomUrl('https://fathom.video/share/123'), true);
  assert.strictEqual(isFathomUrl('https://www.fathom.video/share/abc'), true);
  assert.strictEqual(isFathomUrl('fathom.video/share/xyz'), true);
  // Provider parity: accept protocol-relative URLs too.
  assert.strictEqual(isFathomUrl('//fathom.video/share/xyz'), true);
  // Subdomains are valid.
  assert.strictEqual(isFathomUrl('https://app.fathom.video/share/xyz'), true);
});

test('extractFathomId extracts ids for common URL shapes', () => {
  assert.strictEqual(extractFathomId('https://fathom.video/share/123'), '123');
  assert.strictEqual(extractFathomId('https://fathom.video/recording/abc_123'), 'abc_123');
});

test('isFathomUrl rejects non-fathom links', () => {
  assert.strictEqual(isFathomUrl('https://loom.com/share/123'), false);
  assert.strictEqual(isFathomUrl('https://google.com'), false);
  assert.strictEqual(isFathomUrl(''), false);
  // Avoid false positives.
  assert.strictEqual(isFathomUrl('https://notfathom.video/share/123'), false);
});
