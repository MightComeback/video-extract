import { test } from 'node:test';
import assert from 'node:assert';
import { isFathomUrl } from '../src/fathom.js';

test('isFathomUrl detects valid links', () => {
  assert.strictEqual(isFathomUrl('https://fathom.video/share/123'), true);
  assert.strictEqual(isFathomUrl('https://www.fathom.video/share/abc'), true);
  assert.strictEqual(isFathomUrl('fathom.video/share/xyz'), true);
});

test('isFathomUrl rejects non-fathom links', () => {
  assert.strictEqual(isFathomUrl('https://loom.com/share/123'), false);
  assert.strictEqual(isFathomUrl('https://google.com'), false);
  assert.strictEqual(isFathomUrl(''), false);
});
