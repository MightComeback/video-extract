import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractFathomData } from '../src/extractor.js';

// We can't easily test the full Puppeteer flow in this lightweight CI loop without a mock server or real URL.
// But we can test that the module exports correctly and fails gracefully on bad input.

test('extractFathomData exists', () => {
  assert.equal(typeof extractFathomData, 'function');
});

test('extractFathomData fails on invalid URL', async () => {
  await assert.rejects(
    async () => await extractFathomData('not-a-url'),
    /Error/
  );
});
