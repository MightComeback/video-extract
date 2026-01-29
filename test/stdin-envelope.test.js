import test from 'node:test';
import assert from 'node:assert/strict';

import { extractFromStdin } from '../src/extractor.js';

test('extractFromStdin supports markdown headings like "## Title"', () => {
  const input = [
    'Source: https://fathom.video/share/abc',
    '## Login breaks on Safari',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Login breaks on Safari');
  assert.match(out.text, /00:01/);
});
