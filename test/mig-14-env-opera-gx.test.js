import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects Opera GX', (t) => {
  const transcript = "I'm using Opera GX and the gaming mode is on.";
  const output = renderBrief({ transcript });
  assert.ok(output.includes('Browser / OS: Opera GX'));
});
