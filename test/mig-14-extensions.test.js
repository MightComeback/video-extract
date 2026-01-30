
import { test } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects Browser Extension / Ad blocker issues', () => {
  const cases = [
    'uBlock Origin blocked the request',
    'Might be my ad blocker',
    'AdBlock prevented the script',
    'Ghostery blocked the tracker',
    'Browser extension interfering',
    'Disable extensions to fix',
  ];

  for (const transcript of cases) {
    const actions = generateNextActions(transcript);
    assert.ok(
      actions.includes('- [ ] Check browser extensions / ad blockers'),
      `Failed to detect extension issue in: "${transcript}"`
    );
  }
});
