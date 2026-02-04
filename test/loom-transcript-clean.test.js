import { test, expect } from 'bun:test';
import { parseLoomTranscript } from '../src/providers/loom.js';

test('parseLoomTranscript cleans lightweight markup + decodes common entities in JSON transcripts (provider parity)', () => {
  const input = JSON.stringify({
    paragraphs: [
      { startTime: 0, text: '<c>Hi &amp; welcome</c>' },
      { startTime: 2, text: 'We\u2019re testing &mdash; entities &nbsp;and \"quotes\"' },
      { startTime: 4, text: 'Numeric: &#x2019; and &#8217;.' },
    ],
  });

  const out = parseLoomTranscript(input);
  expect(out).toContain('0:00 Hi & welcome');
  expect(out).toContain('0:02 We’re testing — entities and "quotes"');
  expect(out).toContain("0:04 Numeric: ’ and ’.");
  expect(out).not.toContain('<c>');
  expect(out).not.toContain('&amp;');
});
