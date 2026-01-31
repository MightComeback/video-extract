import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractBugHints } from '../src/brief.js';

test('MIG-14: extractBugHints detects "broken", "timed out", "laggy"', (t) => {
  const transcript = `
    The login page is broken.
    The request timed out after 30 seconds.
    The interface is very laggy when scrolling.
  `;
  const { actual } = extractBugHints(transcript);
  
  // Clean checks
  const broken = actual.find(s => s.includes('broken'));
  const timedOut = actual.find(s => s.includes('timed out'));
  const laggy = actual.find(s => s.includes('laggy'));

  assert.ok(broken, 'Should detect "broken"');
  assert.ok(timedOut, 'Should detect "timed out"');
  // assert.ok(laggy, 'Should detect "laggy"'); // Adding laggy might be risky if common word, sticking to the first two for now or checking context
  assert.ok(laggy, 'Should detect "laggy"');
});
