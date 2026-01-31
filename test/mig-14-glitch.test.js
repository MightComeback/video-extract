import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractBugHints detects glitches', () => {
  const transcript = `
    I was using the app and suddenly the screen glitches badly.
    It happens every time I scroll.
  `;
  const result = renderBrief({ transcript });
  
  // Should appear in Actual section
  assert.match(result, /- Actual: .*glitch.*/i, 'Should extract glitch mention as an Actual result');
});
