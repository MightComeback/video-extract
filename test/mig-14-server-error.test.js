import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: generateNextActions detects 500/server errors without explicit "error" keyword', () => {
  const transcript = `
The API returned a 500 status code.
It failed with a 502 Bad Gateway.
  `.trim();

  const output = renderBrief({ transcript });
  
  assert.ok(output.includes('Check server logs / Sentry'), 'Should suggest checking server logs for 500/502');
});
