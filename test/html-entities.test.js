import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeFetchedContent } from '../src/extractor.js';

test('normalizeFetchedContent decodes &apos; in <title>', () => {
  const html = `<!doctype html><html><head><title>Ivan&apos;s call</title></head><body>Hello</body></html>`;
  const out = normalizeFetchedContent(html);
  assert.equal(out.suggestedTitle, "Ivan's call");
});

test('normalizeFetchedContent tolerates invalid numeric HTML entities (no throw)', () => {
  const html = `<!doctype html><html><head><title>Bad: &#9999999999;</title></head><body>Hello</body></html>`;
  const out = normalizeFetchedContent(html);
  // Best-effort: the bad entity should not crash processing.
  assert.match(out.suggestedTitle, /^Bad:/);
});

test('normalizeFetchedContent decodes common named punctuation entities in <title>', () => {
  const html = `<!doctype html><html><head><title>Roadmap &mdash; Ivan&rsquo;s notes &hellip;</title></head><body>Hello</body></html>`;
  const out = normalizeFetchedContent(html);
  assert.equal(out.suggestedTitle, 'Roadmap — Ivan’s notes …');
});
