import { test } from 'node:test';
import assert from 'node:assert';
import { isLoomUrl, extractLoomMetadataFromHtml } from '../src/loom.js';

test('isLoomUrl', () => {
  assert.ok(isLoomUrl('https://www.loom.com/share/abc-123'));
  assert.ok(isLoomUrl('https://www.loom.com/v/abc-123'));
  assert.strictEqual(isLoomUrl('https://google.com'), false);
});

test('extractLoomMetadataFromHtml - Basic', () => {
  const mockState = {
    "RegularUserVideo:v1": {
      "__typename": "RegularUserVideo",
      "id": "v1",
      "name": "Demo Video",
      "description": "A test description",
      "duration": 60,
      "createdAt": "2023-01-01T00:00:00Z",
      "nullableRawCdnUrl({\"type\":\"M3U8\"})": { "url": "https://cdn.loom/video.m3u8" },
      "owner": { "__ref": "User:u1" }
    },
    "User:u1": {
      "firstName": "Alice",
      "lastName": "Doe"
    }
  };

  const html = `
    <html>
    <script>
      window.__APOLLO_STATE__ = ${JSON.stringify(mockState)};
    </script>
    </html>
  `;

  const meta = extractLoomMetadataFromHtml(html);
  assert.ok(meta, 'Should extract metadata');
  assert.strictEqual(meta.title, 'Demo Video');
  assert.strictEqual(meta.description, 'A test description');
  assert.strictEqual(meta.mediaUrl, 'https://cdn.loom/video.m3u8');
  assert.strictEqual(meta.author, 'Alice Doe');
  assert.strictEqual(meta.date, '2023-01-01T00:00:00Z');
});

test('extractLoomMetadataFromHtml - Transcript Object', () => {
  const mockState = {
    "RegularUserVideo:v1": { "id": "v1", "name": "T" },
    "Transcript:t1": {
      "paragraphs": [
        { "__ref": "TranscriptParagraph:p1" },
        { "__ref": "TranscriptParagraph:p2" }
      ]
    },
    "TranscriptParagraph:p1": { "startTime": 0, "text": "Hello world." },
    "TranscriptParagraph:p2": { "startTime": 2.5, "text": "This is a test." }
  };

  const html = `window.__APOLLO_STATE__ = ${JSON.stringify(mockState)};`;
  const meta = extractLoomMetadataFromHtml(html);
  
  assert.ok(meta.transcriptText, 'Should extract transcript text');
  // 2.5s -> 0:02
  assert.match(meta.transcriptText, /0:00 Hello world./);
  assert.match(meta.transcriptText, /0:02 This is a test./);
});

test('extractLoomMetadataFromHtml - Linked Transcript Precedence', () => {
  const mockState = {
    "RegularUserVideo:v1": { 
      "id": "v1", 
      "name": "Main Video",
      // Explicit link to t2
      "transcript": { "__ref": "Transcript:t2" }
    },
    // Random transcript (should be ignored)
    "Transcript:t1": {
      "paragraphs": [{ "__ref": "TranscriptParagraph:p1" }]
    },
    // Correct transcript
    "Transcript:t2": {
      "paragraphs": [{ "__ref": "TranscriptParagraph:p2" }]
    },
    "TranscriptParagraph:p1": { "startTime": 0, "text": "Wrong transcript." },
    "TranscriptParagraph:p2": { "startTime": 1, "text": "Correct transcript." }
  };

  const html = `window.__APOLLO_STATE__ = ${JSON.stringify(mockState)};`;
  const meta = extractLoomMetadataFromHtml(html);
  
  assert.ok(meta.transcriptText);
  assert.match(meta.transcriptText, /Correct transcript/);
  assert.doesNotMatch(meta.transcriptText, /Wrong transcript/);
});
