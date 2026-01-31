import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects PlayStation', () => {
  const brief = renderBrief({
    transcript: 'The video playback stutters on my PlayStation 5 browser.',
  });
  // Should detect "PlayStation 5" or just "PlayStation"
  assert.match(brief, /PlayStation/);
});

test('MIG-14: extractEnvironment detects Xbox', () => {
  const brief = renderBrief({
    transcript: 'Tested on Xbox Series X via Edge and it crashed.',
  });
  assert.match(brief, /Xbox/);
});

test('MIG-14: extractEnvironment detects Steam Deck', () => {
  const brief = renderBrief({
    transcript: 'It works fine on Steam Deck (SteamOS).',
  });
  assert.match(brief, /Steam Deck|SteamOS/);
});
