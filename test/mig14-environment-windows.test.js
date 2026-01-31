import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects specific Windows versions', () => {
  const cases = [
    { input: 'I came across this bug on Windows 11 yesterday.', expected: 'Windows 11' },
    { input: 'Testing on Windows 10 showed the same issue.', expected: 'Windows 10' },
    { input: 'Windows 7 is unsupported but still reproducible.', expected: 'Windows 7' },
    { input: 'On Windows 8.1 it crashes.', expected: 'Windows 8.1' },
    { input: 'Just plain Windows without version.', expected: 'Windows' },
  ];

  for (const c of cases) {
    const output = renderBrief({
      transcript: c.input,
      source: 'https://fathom.video/share/test',
      title: 'Test',
    });
    // Look for "- Browser / OS: ..." line
    const match = output.match(/- Browser \/ OS: (.*)/);
    assert.ok(match, `Output should contain Browser/OS line for input: "${c.input}"`);
    
    // We expect comma-separated if multiple match, but here we expect single matches or subsets.
    // For 'Windows 11', current logic (before fix) might return 'Windows' or nothing specific if 11 isn't handled.
    // Or it might return "Windows, Windows 11" if I'm not careful.
    // We asserted strictEqual, so we enforce exact match.
    assert.strictEqual(match[1], c.expected, `Input: "${c.input}"`);
  }
});
