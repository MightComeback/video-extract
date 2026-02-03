import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLoomTranscript } from '../src/providers/loom.js';

test('parseLoomTranscript parses {transcript:[{start,end,text}]} shape', () => {
  const json = JSON.stringify({
    transcript: [
      { start: 0.5, end: 2.5, text: 'Hello world' },
      { start: 3.0, end: 5.0, text: 'This is a test.' }
    ]
  });

  const out = parseLoomTranscript(json);
  assert.equal(out, ['0:00 Hello world', '0:03 This is a test.'].join('\n'));
});

test('parseLoomTranscript parses a flat array of {startTime,text}', () => {
  const json = JSON.stringify([
    { startTime: 10, text: 'First segment' },
    { startTime: 20, text: 'Second segment' }
  ]);

  const out = parseLoomTranscript(json);
  assert.equal(out, ['0:10 First segment', '0:20 Second segment'].join('\n'));
});

test('parseLoomTranscript parses WebVTT transcripts', () => {
  const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
Hello

00:00:02.000 --> 00:00:04.000
world
`;

  const out = parseLoomTranscript(vtt);
  assert.equal(out, 'Hello world');
});
