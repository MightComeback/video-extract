import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrlLike } from '../src/brief.js';

test('normalizeUrlLike handles "Fathom recording:" prefix', () => {
  const input = 'Fathom recording: https://fathom.video/share/123';
  const expected = 'https://fathom.video/share/123';
  assert.equal(normalizeUrlLike(input), expected);
});

test('normalizeUrlLike handles "Fathom share:" prefix', () => {
  // "share" is in the regex as `share(?:\s*link)?`
  // what about "Fathom share:"?
  // The regex has `fathom(?:\s*link)?`.
  // It does NOT have `fathom share`.
  const input = 'Fathom share: https://fathom.video/share/123';
  const expected = 'https://fathom.video/share/123';
  assert.equal(normalizeUrlLike(input), expected);
});
