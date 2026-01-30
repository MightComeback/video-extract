import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('renderBrief includes author in Who field if no speakers', () => {
  const output = renderBrief({
    author: 'Ivan',
    transcript: 'Some text without speakers or timestamps.'
  });
  
  // Should fall back to author
  assert.match(output, /- Who: Ivan/);
});

test('renderBrief prefers speakers over author', () => {
  const output = renderBrief({
    author: 'Ivan',
    transcript: 'Alice: Hello everyone.'
  });
  
  // Should use speakers
  assert.match(output, /- Who: Alice/);
  // specific check: Ivan shouldn't be in the Who line if Alice is there
  // Note: assert.doesNotMatch is available in recent node, or use regex
  assert.ok(!/- Who: Ivan/.test(output), 'Should not list author in Who field if speakers are found');
});

test('renderBrief handles missing author and speakers', () => {
  const output = renderBrief({
    transcript: 'Some text only.'
  });
  
  assert.match(output, /- Who: \(unknown\)/);
});
