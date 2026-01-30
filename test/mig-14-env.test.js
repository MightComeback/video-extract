import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects Vivaldi', (t) => {
  const transcript = "I was testing on Vivaldi and it looked weird.";
  const output = renderBrief({ transcript });
  assert.ok(output.includes('Browser / OS: Vivaldi'));
});
