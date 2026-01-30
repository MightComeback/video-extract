import { test } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects Email delivery issues', () => {
  const result = generateNextActions("I didn't receive the confirmation email in my inbox or spam.");
  assert.ok(result.some(a => a.includes('Check email service / spam')), 'Should suggest checking email service. Got: ' + JSON.stringify(result));
});

test('MIG-14: generateNextActions detects Bounced emails', () => {
  const result = generateNextActions("The email bounced back with an error.");
  assert.ok(result.some(a => a.includes('Check email service / spam')), 'Should suggest checking email service. Got: ' + JSON.stringify(result));
});
