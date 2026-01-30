import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: generateNextActions detects "stopped working" as regression', () => {
  const transcript = `
It stopped working this morning.
  `.trim();

  const output = renderBrief({ transcript });
  
  assert.ok(output.includes('Check recent changes'), 'Should suggest checking recent changes for "stopped working"');
});
