import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBrief } from '../src/brief.js';

test('MIG-14: Summary should fallback to Title if Description is missing', () => {
  const brief = renderBrief({
    source: 'https://example.com',
    title: 'Login page crashes on submit',
    description: '', // Empty description
    transcript: 'We found a bug.',
  });

  // Current behavior (expected to fail before fix):
  // check if it falls back to title or shows placeholder
  
  // We WANT it to contain the title in the summary section
  const summarySection = brief.match(/## 1-sentence summary\n- (.*)/);
  assert.ok(summarySection, 'Summary section found');
  
  // Strict assertion: We want 'Login page crashes on submit', not '(add summary)'
  assert.equal(summarySection[1], 'Login page crashes on submit', 'Summary should fallback to Title');
});
