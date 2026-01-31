import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractSeverity } from '../src/brief.js';

test('MIG-14: extractSeverity should recognize P1 as High', (t) => {
  const s = extractSeverity('This is a P1 bug needed for release');
  assert.equal(s, 'High');
});

test('MIG-14: extractSeverity should recognize SEV-2 as High', (t) => {
  const s = extractSeverity('We have a SEV-2 incident');
  assert.equal(s, 'High');
});
