import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: generateNextActions detects regression indicators', () => {
  const transcript = `
It used to work yesterday.
This seems like a regression.
Broken since the last update.
  `.trim();

  const output = renderBrief({ transcript });
  
  assert.ok(output.includes('Check recent changes'), 'Should suggest checking recent changes/commits');
});
