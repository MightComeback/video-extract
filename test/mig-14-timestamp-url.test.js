
import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('renderBrief extracts timestamp from deep-linked URL', () => {
  const brief = renderBrief({
    source: 'https://fathom.video/share/abc?t=65', // 1m 5s
    transcript: '00:01 Hello'
  });

  assert.match(brief, /## Timestamps[\s\S]*- 01:05 \(from URL\) —/);
});
