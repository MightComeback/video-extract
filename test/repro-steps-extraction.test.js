import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractReproSteps detects explicit "Step N" patterns', (t) => {
  const transcript = `
    Here is what I did:
    Step 1: Go to the login page.
    Step 2: Enter invalid credentials.
    Step 3: Click Submit.
    Then it crashed.
  `;
  const output = renderBrief({ transcript });
  
  // Should overwrite the default empty steps with extracted ones
  assert.ok(output.includes('1. Go to the login page.'));
  assert.ok(output.includes('2. Enter invalid credentials.'));
  assert.ok(output.includes('3. Click Submit.'));
});

test('MIG-14: extractReproSteps ignores "Step 1" if it does not look like a list', (t) => {
  const transcript = "I think Step 1 is the most important part of the process.";
  const output = renderBrief({ transcript });
  // Should keep default placeholders if confident extraction fails
  assert.ok(output.includes('1. '));
  assert.ok(!output.includes('1. is the most important'));
});
