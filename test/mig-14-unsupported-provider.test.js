import test from 'node:test';
import assert from 'node:assert/strict';

import { extractFromUrl } from '../src/extractor.js';

test('extractFromUrl includes supported providers in the invalid-URL error', async () => {
  const res = await extractFromUrl('not a url', { noDownload: true });
  assert.equal(res.ok, false);
  assert.match(res.fetchError, /Fathom\/Loom\/YouTube\/Vimeo/i);
});
