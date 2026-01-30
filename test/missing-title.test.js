import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeFetchedContent } from '../src/extractor.js';

test('normalizeFetchedContent returns empty title if missing', () => {
  const html = '<html><body><p>No title here</p></body></html>';
  const result = normalizeFetchedContent(html, 'http://example.com');
  assert.equal(result.suggestedTitle, '');
});
