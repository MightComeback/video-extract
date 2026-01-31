import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions, extractBugHints } from '../src/brief.js';

test('MIG-14: generateNextActions detects Database errors (duplicate keys/deadlocks)', (t) => {
  const transcript = `
    00:01 System: error: duplicate key value violates unique constraint "users_email_key"
    00:02 System: deadlock detected
    00:03 Bob: It seems like a foreign key constraint violation.
  `;
  
  const hints = extractBugHints(transcript).actual;
  const actions = generateNextActions(transcript, hints);

  assert.ok(
    actions.some(a => a.includes('Check database state / migrations')),
    'Should suggest checking database state'
  );
});
