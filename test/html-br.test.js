import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeFetchedContent } from '../src/extractor.js';

test('normalizeFetchedContent preserves line breaks for <br/> tags', () => {
  const html = `<!doctype html><html><head><title>t</title></head><body>Line 1<br/>Line 2<br />Line 3</body></html>`;
  const out = normalizeFetchedContent(html);
  // We don't care about exact formatting, but <br/> should not be collapsed into a single line.
  assert.match(out.text, /Line 1\nLine 2\nLine 3/);
});
