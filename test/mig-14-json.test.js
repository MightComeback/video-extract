import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects JSON parsing errors', () => {
  const t1 = "Uncaught SyntaxError: Unexpected token < in JSON at position 0";
  const actions1 = generateNextActions(t1);
  assert.ok(actions1.some(a => a.includes('Check JSON parsing / payload')), 'Should detect JSON parsing error (token <)');

  const t2 = "Invalid JSON response from server";
  const actions2 = generateNextActions(t2);
  assert.ok(actions2.some(a => a.includes('Check JSON parsing / payload')), 'Should detect invalid JSON');
  
  const t3 = "Converting circular structure to JSON";
  const actions3 = generateNextActions(t3);
  assert.ok(actions3.some(a => a.includes('Check JSON parsing / payload')), 'Should detect circular structure');
});
