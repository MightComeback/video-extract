
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBrief } from '../src/brief.js';

test('extractEnvironment detects specific Android devices', () => {
    const transcript = "I was testing on my Pixel 8 and it crashed.";
    const brief = renderBrief({ transcript });
    // Should detect Pixel
    assert.match(brief, /- Browser \/ OS: .*Pixel.*/);
});

test('extractEnvironment detects Galaxy devices', () => {
  const transcript = "The layout is broken on my Galaxy S24.";
  const brief = renderBrief({ transcript });
  // Should detect Galaxy
  assert.match(brief, /- Browser \/ OS: .*Galaxy.*/);
});

test('extractEnvironment detects Motorola devices', () => {
  const transcript = "I saw the issue on my Motorola Edge.";
  const brief = renderBrief({ transcript });
  assert.match(brief, /- Browser \/ OS: .*Motorola.*/);
});
