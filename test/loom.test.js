import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { isLoomUrl, parseLoomTranscript } from '../src/providers/loom.js';

test('isLoomUrl matches valid URLs', () => {
  assert.ok(isLoomUrl('https://www.loom.com/share/abc12345'), 'Should match share URL');
  assert.ok(isLoomUrl('https://loom.com/v/xyz98765'), 'Should match /v/ URL');
  assert.equal(isLoomUrl('https://google.com'), false, 'Should not match Google');
});

test('parseLoomTranscript handles JSON paragraphs', () => {
  const input = JSON.stringify({ 
    paragraphs: [
      { text: "Hello world", startTime: 5 },
      { text: "Second line", startTime: 65 }
    ] 
  });
  const output = parseLoomTranscript(input);
  
  // 5s -> 0:05, 65s -> 1:05
  assert.match(output, /0:05 Hello world/);
  assert.match(output, /1:05 Second line/);
});
