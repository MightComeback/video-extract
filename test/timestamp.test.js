import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderBrief, extractTimestamps } from '../src/brief.js';

test('extractTimestamps finds hh:mm:ss patterns', () => {
  const text = `
    00:12 Hello world
    [1:02:03] Long video
    (2:30) Parentheses
    No timestamp here.
  `;
  const ts = extractTimestamps(text);
  assert.deepEqual(ts, ['00:12', '1:02:03', '2:30']);
});

test('extractTimestamps respects max limit', () => {
  const text = `
    00:01 one
    00:02 two
    00:03 three
  `;
  const ts = extractTimestamps(text, { max: 2 });
  assert.equal(ts.length, 2);
  assert.deepEqual(ts, ['00:01', '00:02']);
});

test('renderBrief promotes URL timestamp to top of Timestamps section', () => {
  const url = 'https://fathom.video/share/xxxx?t=65'; // 65s = 01:05
  const transcript = '00:10 Intro';
  
  const brief = renderBrief({ url, transcript });
  
  // Should contain "01:05 (from URL)"
  assert.match(brief, /01:05 \(from URL\)/);
  
  // It should be in the Timestamps section
  const lines = brief.split('\n');
  const tsHeaderIndex = lines.indexOf('## Timestamps');
  
  assert.ok(tsHeaderIndex > 0, 'Timestamps header missing');
  // Should be the first item
  assert.ok(lines[tsHeaderIndex + 1].includes('01:05'), 'URL timestamp should be first item');
});
