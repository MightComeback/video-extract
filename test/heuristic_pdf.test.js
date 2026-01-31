import { test } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js'; // Adjust path if needed

test('MIG-14: generateNextActions detects PDF/Export issues', (t) => {
  const transcript = "When I try to download the report as a PDF, it fails.";
  const actions = generateNextActions(transcript);
  assert.ok(actions.includes('- [ ] Check PDF generation / Export service'), 'Action not found in: ' + actions);
});

test('MIG-14: generateNextActions detects corrupted export', (t) => {
  const transcript = "The exported file is corrupted and cannot be opened.";
  const actions = generateNextActions(transcript);
  assert.ok(actions.includes('- [ ] Check PDF generation / Export service'), 'Action not found in: ' + actions);
});
