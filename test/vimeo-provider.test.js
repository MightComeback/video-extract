import assert from 'node:assert/strict';
import test from 'node:test';

import { extractVimeoId, isVimeoUrl } from '../src/providers/vimeo.js';

test('extractVimeoId supports protocol-relative URLs', () => {
  assert.equal(extractVimeoId('//player.vimeo.com/video/12345?h=abc'), '12345');
  assert.equal(extractVimeoId('//vimeo.com/987654321'), '987654321');
});

test('isVimeoUrl supports protocol-relative URLs', () => {
  assert.equal(isVimeoUrl('//player.vimeo.com/video/12345'), true);
  assert.equal(isVimeoUrl('//vimeo.com/987654321'), true);
});

test('extractVimeoId rejects non-vimeo links', () => {
  assert.equal(extractVimeoId('//youtube.com/watch?v=dQw4w9WgXcQ'), null);
});
