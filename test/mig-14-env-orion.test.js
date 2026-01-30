import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects Orion', (t) => {
  const transcript = "I'm seeing this bug on Orion browser.";
  const output = renderBrief({ transcript });
  assert.ok(output.includes('Browser / OS: Orion'));
});
