import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLoomUrl, extractLoomId } from '../src/providers/loom.js';

test('Loom Provider: isLoomUrl', () => {
  assert.equal(isLoomUrl('https://www.loom.com/share/12345'), true);
  assert.equal(isLoomUrl('https://loom.com/share/abc-def'), true);
  assert.equal(isLoomUrl('https://www.loom.com/v/xyz123'), true);
  assert.equal(isLoomUrl('https://loom.com/embed/999'), true);
  
  assert.equal(isLoomUrl('https://google.com'), false);
  assert.equal(isLoomUrl('vimeo.com/123'), false);
  assert.equal(isLoomUrl('https://loom.com/about'), false); // 'about' != share/v/embed
});

test('Loom Provider: extractLoomId', () => {
  assert.equal(extractLoomId('https://www.loom.com/share/12345abc'), '12345abc');
  assert.equal(extractLoomId('https://loom.com/v/xyz-789'), 'xyz-789');
  assert.equal(extractLoomId('https://loom.com/embed/targetId'), 'targetId');
  
  assert.equal(extractLoomId('https://google.com'), null);
});
