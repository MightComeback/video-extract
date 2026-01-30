import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractTimestamps } from '../src/brief.js';

test('extractTimestamps finds HH:MM:SS patterns', () => {
  const input = `
    00:12 Hello
    Some text 1:23:45
    [01:02] bracket style
    (10:20) paren style
    no timestamp here
  `;
  const actual = extractTimestamps(input);
  assert.deepEqual(actual, ['00:12', '1:23:45', '01:02', '10:20']);
});

test('extractTimestamps respects max limit', () => {
  const input = `
    00:01
    00:02
    00:03
    00:04
  `;
  const actual = extractTimestamps(input, { max: 2 });
  assert.equal(actual.length, 2);
  assert.deepEqual(actual, ['00:01', '00:02']);
});

test('extractTimestamps ignores duplicates', () => {
  const input = `
    00:01
    00:01
  `;
  const actual = extractTimestamps(input);
  assert.deepEqual(actual, ['00:01']);
});
