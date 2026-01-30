import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('renderBrief extracts bug hints with "fails" and "crashes"', () => {
  const transcript = `
Ivan: The system fails to load the data.
Alice: Also it crashes when I click the button.
  `.trim();

  const output = renderBrief({ transcript });
  
  // We look for the "Actual" section in the output md
  // Expected output format:
  // - Actual: The system fails to load the data. / Also it crashes when I click the button.
  
  const match = output.match(/- Actual: (.*)/);
  assert.ok(match, 'Output should contain an Actual line');
  
  const actuals = match[1];
  assert.ok(actuals.includes('fails to load'), 'Should detect "fails"');
  assert.ok(actuals.includes('crashes when'), 'Should detect "crashes"');
});
