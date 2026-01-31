import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFetchedContent } from '../src/extractor.js';

test('MIG-14: Resilience - extracts meta content with unquoted attributes', () => {
  // HTML with unquoted attributes (common in minified HTML or loose parsers)
  const html = `<!doctype html>
<html>
<head>
  <meta name=description content=UnquotedVal>
  <meta property=og:title content=UnquotedTitle>
</head>
<body></body>
</html>`;

  const out = normalizeFetchedContent(html);

  // Expect description to be extracted
  assert.equal(out.description, 'UnquotedVal');
  // Expect title to be extracted (implied fallback or explicit extractor check)
  // normalizeFetchedContent sets 'suggestedTitle'
  assert.equal(out.suggestedTitle, 'UnquotedTitle');
});
