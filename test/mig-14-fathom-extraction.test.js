import { test } from 'node:test';
import assert from 'node:assert';
import { extractFathomTranscriptUrl } from '../src/fathom.js';

test('extractFathomTranscriptUrl finds copyTranscriptUrl in JSON', () => {
  const html = `window.state = { copyTranscriptUrl: "https://fathom.video/copy_transcript/123" };`;
  assert.strictEqual(extractFathomTranscriptUrl(html), 'https://fathom.video/copy_transcript/123');
});

test('extractFathomTranscriptUrl finds direct copy_transcript link', () => {
  const html = `<a href="https://fathom.video/copy_transcript/abc">Transcript</a>`;
  assert.strictEqual(extractFathomTranscriptUrl(html), 'https://fathom.video/copy_transcript/abc');
});

test('extractFathomTranscriptUrl returns null when missing', () => {
  assert.strictEqual(extractFathomTranscriptUrl('<div></div>'), null);
});
