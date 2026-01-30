import { test } from 'node:test';
import assert from 'node:assert';
import { resolveAuthor } from '../src/extractor.js';

test('resolveAuthor extracts author from meta tag', () => {
  const html = '<html><head><meta name="author" content="Ivan"></head><body></body></html>';
  assert.strictEqual(resolveAuthor(html), 'Ivan');
});

test('resolveAuthor returns null when missing', () => {
  const html = '<html><head></head><body></body></html>';
  assert.strictEqual(resolveAuthor(html), null);
});
