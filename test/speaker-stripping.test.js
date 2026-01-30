import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('strips short speaker labels', () => {
  const transcript = "Alice: Hello world";
  const out = renderBrief({ transcript }); // defaults to teaserMax=6
  // Expect "Alice: " to be stripped -> "Hello world"
  assert.match(out, /- Hello world/);
  assert.doesNotMatch(out, /Alice:/);
});

test('preserves long prefixes (avoids false positive speakers)', () => {
  // 45 chars long
  const longPrefix = "This is a very long prefix that exceeds forty chars";
  const transcript = `${longPrefix}: payload`;
  const out = renderBrief({ transcript });
  
  // Should NOT strip because prefix > 40 chars
  assert.match(out, new RegExp(`- ${longPrefix}: payload`));
});

test('handles role labels', () => {
  const transcript = "Bob (Host): Welcome";
  const out = renderBrief({ transcript });
  assert.match(out, /- Welcome/);
  assert.doesNotMatch(out, /Bob \(Host\):/);
});
