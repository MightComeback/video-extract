import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractFromUrl } from '../src/extractor.js';

test('MIG-14: YouTube playlist pages fail with a clear actionable error', async (t) => {
  // Ensure we never hit the network: this should fail before any fetch.
  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
  });
  globalThis.fetch = async () => {
    throw new Error('unexpected fetch');
  };

  const res = await extractFromUrl('https://www.youtube.com/playlist?list=PL123');
  assert.equal(res.ok, false);
  assert.match(res.fetchError, /YouTube playlist URLs are not supported/i);
});

test('MIG-14: YouTube channel/handle pages fail with a clear actionable error', async (t) => {
  // Ensure we never hit the network: this should fail before any fetch.
  const oldFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = oldFetch;
  });
  globalThis.fetch = async () => {
    throw new Error('unexpected fetch');
  };

  const res = await extractFromUrl('https://youtube.com/@SomeChannel');
  assert.equal(res.ok, false);
  assert.match(res.fetchError, /channel\/handle URLs are not supported/i);
});
