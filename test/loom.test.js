import { test } from 'node:test';
import assert from 'node:assert';
import { isLoomUrl, parseLoomTranscript, extractLoomMetadataFromHtml } from '../src/providers/loom.js';

test('isLoomUrl identifies valid Loom URLs', () => {
  assert.strictEqual(isLoomUrl('https://www.loom.com/share/abc12345'), true);
  assert.strictEqual(isLoomUrl('http://loom.com/v/xyz987'), true);
  assert.strictEqual(isLoomUrl('https://loom.com/embed/123abcXYZ'), true);
  assert.strictEqual(isLoomUrl('https://google.com'), false);
  assert.strictEqual(isLoomUrl(''), false);
});

test('parseLoomTranscript parses VTT', () => {
  const vtt = "WEBVTT\n\n00:01.000 --> 00:02.000\nHello world";
  const result = parseLoomTranscript(vtt);
  assert.strictEqual(result, 'Hello world');
});

test('extractLoomMetadataFromHtml extracts basic metadata', () => {
  const mockState = {
    "RegularUserVideo:123": {
      "name": "Test Video",
      "duration": 60,
      "thumbnailUrl": "http://img",
      "nullableRawCdnUrlMP4": { "url": "http://video.mp4" },
      "owner": { "__ref": "User:456" }
    },
    "User:456": {
      "fullName": "Alice Bob"
    }
  };
  
  // We need to inject this into a format that extractJsonBlock finds: window.__APOLLO_STATE__ = { ... }
  const html = `<html><script>window.__APOLLO_STATE__ = ${JSON.stringify(mockState)}</script></html>`;
  
  const result = extractLoomMetadataFromHtml(html);
  assert.ok(result, 'Should extract metadata object');
  assert.strictEqual(result.title, "Test Video");
  assert.strictEqual(result.duration, 60);
  assert.strictEqual(result.mediaUrl, "http://video.mp4");
  assert.strictEqual(result.author, "Alice Bob");
});
