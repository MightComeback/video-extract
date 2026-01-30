import { test } from 'node:test';
import assert from 'node:assert';
import { extractPaths } from '../src/brief.js';

test('extractPaths finds URL paths in text', () => {
  const text = `
    I was looking at /settings/profile and it crashed.
    Then I went to /dashboard.
    Also check https://example.com/foo.
  `;
  const paths = extractPaths(text);
  assert.ok(paths.includes('/settings/profile'));
  assert.ok(paths.includes('/dashboard'));
  // Should ideally ignore full URLs if better logic exists, or keep them.
  // For now let's just assert it finds the relative paths.
});

test('extractPaths ignores common words', () => {
    const text = "This is / not a path";
    const paths = extractPaths(text);
    assert.strictEqual(paths.length, 0);
});
