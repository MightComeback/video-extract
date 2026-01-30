import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractBugHints detects blank/white screen', () => {
  const transcript = `
When I load the page, I just see a blank screen.
Sometimes it is a white screen of death.
  `.trim();

  const output = renderBrief({ transcript });
  const match = output.match(/- Actual: (.*)/);
  assert.ok(match, 'Output should contain an Actual line');
  
  const actuals = match[1];
  assert.ok(actuals.includes('blank screen'), 'Should detect "blank screen"');
  assert.ok(actuals.includes('white screen'), 'Should detect "white screen"');
});
