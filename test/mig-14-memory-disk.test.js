import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects Disk Space issues', (t) => {
  const actions = generateNextActions('error: no space left on device');
  assert.ok(actions.includes('- [ ] Check disk space / cleanup'), 'Should enable disk check');
});

test('MIG-14: generateNextActions detects Out of Memory / OOM', (t) => {
  const actions = generateNextActions('The process crashed with OOM kill.');
  assert.ok(actions.includes('- [ ] Check memory usage / OOM'), 'Should enable memory check');
});
