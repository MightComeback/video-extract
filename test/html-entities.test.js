import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeFetchedContent } from '../src/extractor.js';

test('normalizeFetchedContent decodes &apos; in <title>', () => {
  const html = `<!doctype html><html><head><title>Ivan&apos;s call</title></head><body>Hello</body></html>`;
  const out = normalizeFetchedContent(html);
  assert.equal(out.suggestedTitle, "Ivan's call");
});
