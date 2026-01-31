import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects Ladybird browser', (t) => {
  const transcript = "I was trying to load the page in Ladybird browser and it crashed.";
  const output = renderBrief({ transcript });
  assert.ok(output.includes('Browser / OS: Ladybird'));
});
