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

test('MIG-14: YouTube playlist pages fail with a clear actionable error', async (t) => {
  // Ensure we never hit the network: this should fail before any fetch.
  preventFetch(t);

  const res = await extractFromUrl('https://www.youtube.com/playlist?list=PL1234567890abcdef');
  assert.equal(res.ok, false);
  assert.match(res.fetchError, /playlist URLs are not supported/i);
  assert.match(res.fetchError, /watch\?v=/i);
  assert.match(res.text, /Unable to fetch this link\./i);
});

test('MIG-14: YouTube channel/handle pages fail with a clear actionable error', async (t) => {
  // Ensure we never hit the network: this should fail before any fetch.
  preventFetch(t);

  const res = await extractFromUrl('https://www.youtube.com/@SomeChannel');
  assert.equal(res.ok, false);
  assert.match(res.fetchError, /channel\/handle URLs are not supported/i);
  assert.match(res.fetchError, /watch\?v=/i);
  assert.match(res.text, /Unable to fetch this link\./i);
});

test('MIG-14: YouTube search results pages fail with a clear actionable error', async (t) => {
  // Ensure we never hit the network: this should fail before any fetch.
  preventFetch(t);

  const res = await extractFromUrl('https://www.youtube.com/results?search_query=test');
  assert.equal(res.ok, false);
  assert.match(res.fetchError, /does not appear to be a direct video link/i);
  assert.match(res.fetchError, /watch\?v=/i);
  assert.match(res.text, /Unable to fetch this link\./i);
});

test('MIG-14: YouTube watch pages without v=... fail with a clear actionable error', async (t) => {
  // Ensure we never hit the network: this should fail before any fetch.
  preventFetch(t);

  const res = await extractFromUrl('https://www.youtube.com/watch');
  assert.equal(res.ok, false);
  assert.match(res.fetchError, /does not appear to be a direct video link/i);
  assert.match(res.fetchError, /watch\?v=/i);
  assert.match(res.text, /Unable to fetch this link\./i);
});
