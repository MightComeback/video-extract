import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects Incognito / Private Mode', () => {
  const brief1 = renderBrief({ transcript: "I was using Incognito mode on Chrome." });
  // Check if "Incognito" appears in the Environment line
  assert.match(brief1, /- Browser \/ OS:.*Incognito/i, 'Should detect Incognito mode');

  const brief2 = renderBrief({ transcript: "Opened a Private Window in Firefox." });
  assert.match(brief2, /- Browser \/ OS:.*Private Window/i, 'Should detect Private Window');

  const brief3 = renderBrief({ transcript: "Private Browsing is enabled." });
  assert.match(brief3, /- Browser \/ OS:.*Private Browsing/i, 'Should detect Private Browsing');
});
