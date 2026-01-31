import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBrief } from '../src/brief.js';

test('Suggested issue title uses description if available', () => {
  const output = renderBrief({
    source: 'https://example.com',
    title: 'Generic Meeting',
    description: 'Login page crashes on Safari',
    transcript: 'Full transcript here...'
  });

  assert.match(output, /Suggested issue title: Login page crashes on Safari/);
});

test('Suggested issue title falls back to title if description missing', () => {
  const output = renderBrief({
    source: 'https://example.com',
    title: 'Specific Bug Title',
    transcript: 'Full transcript here...'
  });

  assert.match(output, /Suggested issue title: Specific Bug Title/);
});
