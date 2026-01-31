import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: renderBrief extracts browser extensions', (t) => {
  const output = renderBrief({ transcript: 'I am using uBlock Origin and 1Password.' });
  // Check if extracted in the environment line
  assert.ok(output.includes('Ublock'), 'Should extract uBlock');
  assert.ok(output.includes('1password'), 'Should extract 1Password');
});

test('MIG-14: renderBrief extracts React DevTools', (t) => {
  const output = renderBrief({ transcript: 'Checking verification in React DevTools.' });
  assert.ok(output.includes('React devtools'));
});
