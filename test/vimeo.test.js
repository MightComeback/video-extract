import { test } from 'node:test';
import assert from 'node:assert';
import { isVimeoUrl, extractVimeoId } from '../src/vimeo.js';

test('isVimeoUrl identifies Vimeo URLs', () => {
  assert.ok(isVimeoUrl('https://vimeo.com/123456789'));
  assert.ok(isVimeoUrl('https://vimeo.com/channels/staffpicks/123456789'));
  assert.ok(isVimeoUrl('vimeo.com/123456789'));
  
  assert.equal(isVimeoUrl('https://youtube.com/watch?v=123'), false);
  assert.equal(isVimeoUrl('https://example.com'), false);
});

test('extractVimeoId extracts numeric ID', () => {
  assert.equal(extractVimeoId('https://vimeo.com/123456789'), '123456789');
  assert.equal(extractVimeoId('https://vimeo.com/channels/staffpicks/987654321'), '987654321');
});
