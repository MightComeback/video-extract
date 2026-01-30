import test from 'node:test';
import assert from 'node:assert/strict';
import { renderBrief } from '../src/brief.js';

test('renderBrief is resilient to undefined optional fields', (t) => {
  // Call with absolutely nothing
  const output1 = renderBrief();
  assert.match(output1, /# Bug report brief/);
  assert.match(output1, /Source: \(unknown\)/);
  assert.match(output1, /Title: \(unknown\)/);

  // Call with empty object
  const output2 = renderBrief({});
  assert.match(output2, /# Bug report brief/);
  assert.ok(!output2.includes('undefined'));
  assert.ok(!output2.includes('null'));
});

test('renderBrief handles fetchError objects gracefully', (t) => {
  const output = renderBrief({
    fetchError: new Error('Network timeout'),
  });
  assert.match(output, /Fetch error: Error: Network timeout/);
});

test('renderBrief limits fall back to default on invalid input', (t) => {
  // Pass "garbage" which converts to NaN
  const output = renderBrief({
    transcript: '- Line 1\n- Line 2\n- Line 3\n- Line 4\n- Line 5\n- Line 6\n- Line 7',
    teaserMax: 'invalid-number',
  });
  // Should fallback to default (6) and show the section
  assert.match(output, /## Transcript teaser/);
  // Simple check that it didn't return empty array (implied by section presence check + default behavior)
});

test('renderBrief respects zero limits', (t) => {
  const output = renderBrief({
    transcript: 'Some transcript\nwith lines',
    teaserMax: 0,
    timestampsMax: 0,
  });
  // Should not contain "Transcript teaser" or "Timestamps" sections
  assert.doesNotMatch(output, /## Transcript teaser/);
  assert.doesNotMatch(output, /## Timestamps/);
});
