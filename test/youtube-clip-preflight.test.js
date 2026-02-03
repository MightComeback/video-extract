import { test } from 'node:test';
import assert from 'node:assert';
import { extractFromUrl } from '../src/extractor.js';

test('extractFromUrl provides a helpful error for YouTube clip URLs', async () => {
  const res = await extractFromUrl('https://www.youtube.com/clip/UgkxyZKk3VwzExampleClipId', {
    noDownload: true,
    noSplit: true,
  });

  assert.equal(res.ok, false);
  assert.ok(/clip urls are not supported/i.test(res.fetchError || ''), `Unexpected fetchError: ${res.fetchError}`);
  assert.ok(/watch\?v=/i.test(res.text || ''), 'Should suggest using a canonical watch URL');
});
