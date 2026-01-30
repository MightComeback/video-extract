import { test } from 'node:test';
import assert from 'node:assert';
import { resolveAuthor, extractFromStdin } from '../src/extractor.js';

test('resolveAuthor extracts author from meta tag', () => {
  const html = '<html><head><meta name="author" content="Ivan"></head><body></body></html>';
  assert.strictEqual(resolveAuthor(html), 'Ivan');
});

test('resolveAuthor returns null when missing', () => {
  const html = '<html><head></head><body></body></html>';
  assert.strictEqual(resolveAuthor(html), null);
});

test('extractFromStdin extracts Author header', () => {
  const input = `
Author: Alice
https://fathom.video/...
Transcipt...
  `.trim();
  const res = extractFromStdin({ content: input });
  assert.strictEqual(res.author, 'Alice');
});

test('extractFromStdin extracts By header', () => {
  const input = `
By: Bob
Transcipt...
  `.trim();
  const res = extractFromStdin({ content: input });
  assert.strictEqual(res.author, 'Bob');
});

test('resolveAuthor handles metadata with mixed quotes', () => {
  const html = '<html><head><meta name="author" content="Liam O\'Connor"></head><body></body></html>';
  assert.strictEqual(resolveAuthor(html), "Liam O'Connor");
});

test('resolveAuthor handles reversed attributes', () => {
  const html = '<html><head><meta content="Reverse" name="author"></head><body></body></html>';
  assert.strictEqual(resolveAuthor(html), 'Reverse');
});
