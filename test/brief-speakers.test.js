import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('extracts unique speakers from transcript', () => {
  const transcript = `
Alice: Hey everyone.
Bob (Host): Hello Alice.
Alice: How are you?
Charlie [Guest]: I am here too.
Dave: I'm just listening.
Alice: Cool.
  `.trim();

  const brief = renderBrief({
    source: 'http://example.com',
    transcript,
    timestampsMax: 0,
    teaserMax: 0
  });

  // Should contain the list of speakers in the "Who" field
  // note: renderBrief joins them with ", "
  // We expect Alice, Bob (Host), Charlie [Guest], Dave
  // Actually, extractEnvironment returns deduplicated values.
  // We should check if the line "- Who: " contains these names.
  
  const whoLine = brief.split('\n').find(line => line.startsWith('- Who: '));
  assert.ok(whoLine, 'Brief should have a "Who" line');
  
  // The implementation details: likely we want just the names, or maybe names + roles?
  // User didn't specify, but keeping roles seems useful for context.
  
  assert.ok(whoLine.includes('Alice'), 'Should contain Alice');
  assert.ok(whoLine.includes('Bob (Host)'), 'Should contain Bob (Host)');
  assert.ok(whoLine.includes('Charlie [Guest]'), 'Should contain Charlie [Guest]');
  assert.ok(whoLine.includes('Dave'), 'Should contain Dave');
});

test('handles empty transcript', () => {
  const brief = renderBrief({ source: 'http://example.com', transcript: '' });
  const whoLine = brief.split('\n').find(line => line.startsWith('- Who: '));
  assert.equal(whoLine, '- Who: (unknown)');
});
