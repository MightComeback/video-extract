import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects Search issues', () => {
  const actions = generateNextActions('The search returns no results when I filter by name.');
  assert(actions.includes('- [ ] Check search indexing / query logic'));
});

test('MIG-14: generateNextActions detects Timezone issues', () => {
  const actions = generateNextActions('The date shows up as UTC but I am in PST, showing wrong time.');
  assert(actions.includes('- [ ] Check timezone conversions / formatting'));
});
