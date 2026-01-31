import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects extensions', () => {
  const transcript = "I was testing with Proton Pass and Dashlane active.";
  const brief = renderBrief({ transcript });
  
  assert.match(brief, /Proton Pass/);
  assert.match(brief, /Dashlane/);
});

test('MIG-14: extractEnvironment detects Opera GX', () => {
  const transcript = "User reported issue on Opera GX browser.";
  const brief = renderBrief({ transcript });

  assert.match(brief, /Opera GX/);
});
