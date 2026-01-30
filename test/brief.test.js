import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('renderBrief extracts bug hints', () => {
  const transcript = `
    Alice: I clicked the button and expected it to save.
    Bob: But instead it crashed.
    Alice: Yeah, the actual behavior is a 500 error.
    Bob: It works on Staging though.
  `;

  const output = renderBrief({ transcript });

  assert.match(output, /Expected: .*expected it to save/);
  assert.match(output, /Actual: .*instead it crashed/);
  assert.match(output, /Actual: .*actual behavior is a 500 error/);
});
