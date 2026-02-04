import test from 'node:test';
import assert from 'node:assert/strict';

import { isLoomDomain, loomNonVideoReason } from '../src/providers/loom.js';
import { extractFromUrl } from '../src/extractor.js';

test('MIG-14: Loom non-video pages fail with a clear actionable error', async (t) => {
  const u = 'https://loom.com/pricing';

  assert.equal(isLoomDomain(u), true);
  assert.match(loomNonVideoReason(u), /does not appear to be a direct video link/i);
  assert.match(loomNonVideoReason(u), /loom\.com\/share\/<id>/i);

  // Ensure we never hit the network: this should fail before any fetch.
  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
  });
  globalThis.fetch = async () => {
    throw new Error('unexpected fetch');
  };

  const res = await extractFromUrl(u, { version: '0.0.0', noDownload: true });
  assert.equal(res.ok, false);
  assert.match(res.fetchError, /direct video link/i);
  assert.match(res.fetchError, /loom\.com\/share\/<id>/i);
  // For non-video Loom pages, we should still include the actionable error message in the rendered text.
  assert.match(res.text, /direct video link/i);
});
