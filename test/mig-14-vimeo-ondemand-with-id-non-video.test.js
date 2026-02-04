import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractFromUrl } from '../src/extractor.js';

test('MIG-14: Vimeo on-demand URLs that include a numeric id still fail early with a clear error', async (t) => {
  // Ensure we never hit the network: this should fail before any fetch.
  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
  });
  globalThis.fetch = async () => {
    throw new Error('unexpected fetch');
  };

  // Some on-demand URLs include a numeric segment that looks like a clip id,
  // but they are still not extractable as a normal Vimeo clip URL.
  const res = await extractFromUrl('https://vimeo.com/ondemand/somefilm/123456789');
  assert.equal(res.ok, false);
  assert.match(res.fetchError, /Vimeo on-demand pages are not supported/i);
  assert.match(res.text, /Vimeo notes:/i);
});
