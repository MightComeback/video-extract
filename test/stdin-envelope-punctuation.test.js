import test from 'node:test';
import assert from 'node:assert/strict';

import { extractFromStdin } from '../src/extractor.js';

test('extractFromStdin strips common trailing chat punctuation from Source URLs', () => {
  const input = [
    'Source: https://fathom.video/share/abc!)',
    'Title: Punctuation',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Punctuation');
});
