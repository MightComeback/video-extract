import { test } from 'node:test';
import assert from 'node:assert';
import { findTranscriptInObject, extractTranscriptUrlFromHtml } from '../src/extractor.js';

test('findTranscriptInObject handles empty/null input', () => {
  assert.strictEqual(findTranscriptInObject(null), '');
  assert.strictEqual(findTranscriptInObject({}), '');
  assert.strictEqual(findTranscriptInObject([]), '');
});

test('findTranscriptInObject formats transcript array', () => {
  const input = [
    { startTime: 0, text: 'Hello' },
    { startTime: 65, text: 'World' }
  ];
  const expected = '0:00: Hello\n1:05: World';
  assert.strictEqual(findTranscriptInObject(input), expected);
});

test('findTranscriptInObject handles nested transcript property', () => {
  const input = {
    transcript: [
      { start: 10.5, text: 'Test' }
    ]
  };
  const expected = '0:10: Test';
  assert.strictEqual(findTranscriptInObject(input), expected);
});

test('extractTranscriptUrlFromHtml finds VTT urls', () => {
  const html = '<div><script>var src="https://cdn.loom.com/file.vtt";</script></div>';
  const result = extractTranscriptUrlFromHtml(html, 'http://example.com');
  assert.strictEqual(result, 'https://cdn.loom.com/file.vtt');
});

test('extractTranscriptUrlFromHtml prioritizes english VTT', () => {
  const html = `
    "https://cdn.loom.com/file_es.vtt"
    "https://cdn.loom.com/file_en.vtt"
    "https://cdn.loom.com/file_fr.vtt"
  `;
  const result = extractTranscriptUrlFromHtml(html);
  assert.strictEqual(result, 'https://cdn.loom.com/file_en.vtt');
});

test('extractTranscriptUrlFromHtml handles query params', () => {
  const html = '"https://cdn.loom.com/sub.vtt?token=123"';
  const result = extractTranscriptUrlFromHtml(html);
  assert.strictEqual(result, 'https://cdn.loom.com/sub.vtt?token=123');
});

test('findTranscriptInObject formats hours correctly', () => {
  const input = [{ startTime: 3665, text: 'Long video' }];
  const expected = '1:01:05: Long video';
  assert.strictEqual(findTranscriptInObject(input), expected);
});
