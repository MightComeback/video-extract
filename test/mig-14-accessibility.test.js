import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects Accessibility (a11y) issues', () => {
  const actions = generateNextActions('The keyboard focus order is incorrect on the login modal.');
  assert(actions.includes('- [ ] Check accessibility / keyboard navigation'));
});

test('MIG-14: generateNextActions detects Screen Reader issues', () => {
  const actions = generateNextActions('VoiceOver does not announce the error message.');
  assert(actions.includes('- [ ] Check accessibility / keyboard navigation'));
});

test('MIG-14: generateNextActions detects Contrast issues', () => {
  const actions = generateNextActions('The text contrast is too low for accessibility.');
  assert(actions.includes('- [ ] Check accessibility / keyboard navigation'));
});
