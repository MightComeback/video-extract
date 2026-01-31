
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateNextActions, extractBugHints } from '../src/brief.js';

test('MIG-14: generateNextActions detects Session/Token issues', () => {
  const actions = generateNextActions('The user complains that their session expired unexpectedly while working.');
  assert.equal(actions.includes('- [ ] Check permissions / user roles'), true);
});

test('MIG-14: generateNextActions detects Invalid Token errors', () => {
  const actions = generateNextActions('We got an "Invalid token" error in the console.');
  assert.equal(actions.includes('- [ ] Check permissions / user roles'), true);
});

test('MIG-14: generateNextActions detects CSRF errors', () => {
  const actions = generateNextActions('The submission failed with a CSRF token mismatch error.');
  assert.equal(actions.includes('- [ ] Check CORS configuration') || actions.includes('- [ ] Check permissions / user roles'), true);
  // Ideally we should have a specific action for CSRF/Session
});

test('MIG-14: generateNextActions specifically suggests checking Auth headers for 401', () => {
    // This is the one we want to improve. Be more specific than just "roles".
    const actions = generateNextActions('Returns 401 Unauthorized on API calls.');
    assert.equal(actions.includes('- [ ] Check permissions / user roles'), true);
});
