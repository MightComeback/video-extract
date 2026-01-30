import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects API tools (Postman/curl)', () => {
  const t1 = 'I tried sending the request via Postman and got a 200 OK.';
  const actions1 = generateNextActions(t1);
  assert.ok(actions1.some(a => a.includes('Reproduce via API client')), 'Should suggest API reproduction for Postman');

  const t2 = 'Running this curl command fails: curl -X POST ...';
  const actions2 = generateNextActions(t2);
  assert.ok(actions2.some(a => a.includes('Reproduce via API client')), 'Should suggest API reproduction for curl');
});
