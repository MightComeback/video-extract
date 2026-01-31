import assert from 'node:assert';
import { test } from 'node:test';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extracts stack traces from transcript', () => {
  const transcript = `
Alice: It crashed.
Bob: What is the error?
Alice: Here:
ReferenceError: foo is not defined
    at Object.<anonymous> (/app/index.js:10:1)
    at Module._compile (node:internal/modules/cjs/loader:1103:14)
Bob: Oh I see.
`;

  const output = renderBrief({ transcript });
  
  // Should detect the stack trace and include it in the brief, 
  // ideally under Console/logs or a new section.
  
  // For this test, we expect it to be present in the output formatted as a code block.
  assert.ok(output.includes('```'), 'Output should contain a code block');
  assert.ok(output.includes('ReferenceError: foo is not defined'), 'Output should contain the error message');
  assert.ok(output.includes('at Object.<anonymous>'), 'Output should contain the stack frame');
});
