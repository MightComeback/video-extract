import test from 'node:test';
import assert from 'node:assert/strict';

import { parseVimeoTranscript } from '../src/providers/vimeo.js';

test('parseVimeoTranscript parses JSON cue lists and sorts by start time when present', () => {
  const body = JSON.stringify({
    cues: [
      { start: 12.3, text: 'Hello' },
      { start: 4, text: 'Intro' },
      { startTime: 61, caption: 'Next up' },
    ],
  });

  const out = parseVimeoTranscript(body);
  assert.equal(out, '0:04 Intro\n0:12 Hello\n1:01 Next up');
});

test('parseVimeoTranscript joins JSON transcript items without timestamps when absent', () => {
  const body = JSON.stringify({ transcript: [{ text: 'One' }, { text: 'Two' }] });
  assert.equal(parseVimeoTranscript(body), 'One Two');
});

test('parseVimeoTranscript falls back to VTT parsing', () => {
  const vtt = `WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nHello\n\n00:00:01.000 --> 00:00:02.000\nWorld\n`;
  assert.equal(parseVimeoTranscript(vtt), 'Hello World');
});

test('parseVimeoTranscript strips lightweight HTML tags and decodes entities in JSON cues', () => {
  const body = JSON.stringify({
    cues: [
      { start: 0, text: '<c>One</c> &amp; Two' },
      { start: 1, text: 'It&#39;s fine &mdash; really.' },
    ],
  });

  assert.equal(parseVimeoTranscript(body), "0:00 One & Two\n0:01 It's fine — really.");
});
