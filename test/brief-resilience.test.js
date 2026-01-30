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
