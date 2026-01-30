import { test } from 'node:test';
import { strictEqual } from 'node:assert';
import { normalizeUrlLike } from '../src/brief.js';

test('normalizeUrlLike: extended aliases', () => {
  const u = 'https://fathom.video/share/123';

  // Basic aliases
  strictEqual(normalizeUrlLike(`Meeting: ${u}`), u);
  strictEqual(normalizeUrlLike(`Call: ${u}`), u);
  strictEqual(normalizeUrlLike(`Link: ${u}`), u);
  
  // Specific platforms
  strictEqual(normalizeUrlLike(`Zoom link: ${u}`), u);
  strictEqual(normalizeUrlLike(`Webex link: ${u}`), u);
  strictEqual(normalizeUrlLike(`Loom link: ${u}`), u);
  strictEqual(normalizeUrlLike(`Teams link: ${u}`), u);
  strictEqual(normalizeUrlLike(`Microsoft Teams link: ${u}`), u);
  strictEqual(normalizeUrlLike(`Google Meet link: ${u}`), u);

  // Separators (dash)
  strictEqual(normalizeUrlLike(`Meeting - ${u}`), u);
  strictEqual(normalizeUrlLike(`Zoom link - ${u}`), u);
  
  // Stacking (prefix + wrapper)
  strictEqual(normalizeUrlLike(`Meeting: <${u}>`), u);
});
