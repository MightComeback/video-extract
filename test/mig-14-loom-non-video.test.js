import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractFromUrl } from '../src/extractor.js';

function preventFetch(t) {
  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
  });
  globalThis.fetch = async () => {
    throw new Error('unexpected fetch');
  };
}

test('MIG-14: Loom login pages fail with a clear actionable error', async (t) => {
  // Ensure we never hit the network: this should fail before any fetch.
  preventFetch(t);

  const res = await extractFromUrl('https://loom.com/login');
  assert.equal(res.ok, false);
  assert.match(res.fetchError, /does not appear to be a direct video link/i);
  assert.match(res.fetchError, /loom\.com\/share\//i);
  assert.match(res.text, /Unable to fetch this link\./i);
});

test('MIG-14: Loom pricing pages fail with a clear actionable error', async (t) => {
  // Ensure we never hit the network: this should fail before any fetch.
  preventFetch(t);

  const res = await extractFromUrl('https://www.loom.com/pricing');
  assert.equal(res.ok, false);
  assert.match(res.fetchError, /does not appear to be a direct video link/i);
  assert.match(res.fetchError, /loom\.com\/share\//i);
  assert.match(res.text, /Unable to fetch this link\./i);
});
