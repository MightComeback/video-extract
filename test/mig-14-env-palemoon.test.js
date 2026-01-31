import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects Pale Moon', (t) => {
  const transcript = "The layout is completely broken when I view it in Pale Moon browser on Linux.";
  const output = renderBrief({ transcript });
  assert.ok(output.includes('Browser / OS: Pale Moon'), `Expected "Pale Moon" in output, got: ${output}`);
});
