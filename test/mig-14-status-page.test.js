import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects Status Page mentions', () => {
  const t = `
    Alice: I checked the status page but it shows all green.
    Bob: Maybe it hasn't updated yet.
  `;
  const actions = generateNextActions(t);
  assert.ok(
    actions.some((a) => a.includes('Check external status page')),
    `Expected 'Check external status page' in ${actions}`
  );
});
