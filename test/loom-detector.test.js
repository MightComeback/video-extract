import { test } from 'node:test';
import assert from 'node:assert';
import { isLoomUrl, extractLoomId } from '../src/loom.js';

test('isLoomUrl identifies valid Loom URLs', (t) => {
  assert.strictEqual(isLoomUrl('https://www.loom.com/share/1234567890abcdef'), true);
  assert.strictEqual(isLoomUrl('https://loom.com/share/1234567890abcdef'), true);
  assert.strictEqual(isLoomUrl('https://www.loom.com/v/1234567890abcdef'), true);
  assert.strictEqual(isLoomUrl('https://www.loom.com/embed/1234567890abcdef'), true);
});

test('isLoomUrl rejects invalid URLs', (t) => {
  assert.strictEqual(isLoomUrl('https://google.com/share/123'), false);
  assert.strictEqual(isLoomUrl('https://google.com/?q=loom.com/share/123'), false);
  assert.strictEqual(isLoomUrl('https://www.loom.com/'), false);
  assert.strictEqual(isLoomUrl(''), false);
  assert.strictEqual(isLoomUrl(null), false);
});

test('isLoomUrl allows IDs with dashes', (t) => {
  assert.strictEqual(isLoomUrl('https://www.loom.com/share/abc-123-def'), true);
});

test('extractLoomId extracts ID correctly', (t) => {
  assert.strictEqual(extractLoomId('https://www.loom.com/share/abcdef123'), 'abcdef123');
  assert.strictEqual(extractLoomId('https://www.loom.com/v/xyz789'), 'xyz789');
  assert.strictEqual(extractLoomId('https://www.loom.com/embed/foo555'), 'foo555');
});

test('extractLoomId extracts IDs with dashes fully', (t) => {
  const id = 'abc-123-def';
  assert.strictEqual(extractLoomId(`https://www.loom.com/share/${id}`), id);
});

test('extractLoomId returns null for invalid URLs', (t) => {
  assert.strictEqual(extractLoomId('https://google.com'), null);
});
