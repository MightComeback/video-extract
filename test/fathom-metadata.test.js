import { test } from 'node:test';
import assert from 'node:assert';
import { extractFathomMetadataFromHtml, fetchFathomOembed } from '../src/providers/fathom.js';

test('extractFathomMetadataFromHtml extracts metadata from OpenGraph tags', () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Test Fathom Recording">
        <meta property="og:description" content="A test recording for debugging">
        <meta property="og:image" content="https://cdn.fathom.video/thumb.jpg">
      </head>
    </html>
  `;

  const result = extractFathomMetadataFromHtml(html);

  assert.strictEqual(result.title, 'Test Fathom Recording');
  assert.strictEqual(result.description, 'A test recording for debugging');
  assert.strictEqual(result.thumbnailUrl, 'https://cdn.fathom.video/thumb.jpg');
});

test('extractFathomMetadataFromHtml extracts metadata from Twitter Card tags', () => {
  const html = `
    <html>
      <head>
        <meta name="twitter:title" content="Twitter Title">
        <meta name="twitter:description" content="Twitter Description">
      </head>
    </html>
  `;

  const result = extractFathomMetadataFromHtml(html);

  assert.strictEqual(result.title, 'Twitter Title');
  assert.strictEqual(result.description, 'Twitter Description');
});

test('extractFathomMetadataFromHtml extracts metadata from JSON-LD', () => {
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@type": "VideoObject",
            "name": "JSON-LD Title",
            "description": "JSON-LD Description",
            "thumbnailUrl": "https://cdn.fathom.video/json-thumb.jpg",
            "author": { "name": "Test Author" },
            "uploadDate": "2024-01-15T10:30:00Z",
            "duration": "PT5M30S"
          }
        </script>
      </head>
    </html>
  `;

  const result = extractFathomMetadataFromHtml(html);

  assert.strictEqual(result.title, 'JSON-LD Title');
  assert.strictEqual(result.description, 'JSON-LD Description');
  assert.strictEqual(result.thumbnailUrl, 'https://cdn.fathom.video/json-thumb.jpg');
  assert.strictEqual(result.author, 'Test Author');
  assert.strictEqual(result.date, '2024-01-15T10:30:00Z');
  assert.strictEqual(result.duration, 330); // 5*60 + 30
});

test('extractFathomMetadataFromHtml extracts transcriptUrl from copyTranscriptUrl', () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Test">
      </head>
      <script>
        window.__DATA__ = {
          "copyTranscriptUrl": "https://api.fathom.video/share/abc123/copy_transcript"
        };
      </script>
    </html>
  `;

  const result = extractFathomMetadataFromHtml(html);

  assert.strictEqual(result.title, 'Test');
  assert.strictEqual(result.transcriptUrl, 'https://api.fathom.video/share/abc123/copy_transcript');
});

test('extractFathomMetadataFromHtml extracts mediaUrl from downloadUrl JSON blob', () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Test">
      </head>
      <script>
        window.__DATA__ = {
          "downloadUrl": "https://cdn.fathom.video/video.mp4?token=xyz"
        };
      </script>
    </html>
  `;

  const result = extractFathomMetadataFromHtml(html);

  assert.strictEqual(result.title, 'Test');
  assert.strictEqual(result.mediaUrl, 'https://cdn.fathom.video/video.mp4?token=xyz');
});

test('extractFathomMetadataFromHtml extracts mediaUrl from escaped JSON URLs', () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Test">
      </head>
      <script>
        window.__DATA__ = {
          "mediaUrl": "https:\/\/cdn.fathom.video\/escaped.mp4"
        };
      </script>
    </html>
  `;

  const result = extractFathomMetadataFromHtml(html);

  assert.strictEqual(result.mediaUrl, 'https://cdn.fathom.video/escaped.mp4');
});

test('extractFathomMetadataFromHtml handles protocol-relative URLs', () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Test">
      </head>
      <script>
        window.__DATA__ = {
          "downloadUrl": "//cdn.fathom.video/video.mp4"
        };
      </script>
    </html>
  `;

  const result = extractFathomMetadataFromHtml(html);

  assert.strictEqual(result.mediaUrl, 'https://cdn.fathom.video/video.mp4');
});

test('extractFathomMetadataFromHtml prefers OpenGraph over Twitter Card', () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="OG Title">
        <meta name="twitter:title" content="Twitter Title">
      </head>
    </html>
  `;

  const result = extractFathomMetadataFromHtml(html);

  assert.strictEqual(result.title, 'OG Title');
});

test('extractFathomMetadataFromHtml returns empty object for empty HTML', () => {
  const result = extractFathomMetadataFromHtml('');
  // Empty HTML returns empty object (no metadata found)
  assert.deepStrictEqual(result, {});
});

test('extractFathomMetadataFromHtml handles duration as plain seconds', () => {
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@type": "VideoObject",
            "duration": 300
          }
        </script>
      </head>
    </html>
  `;

  const result = extractFathomMetadataFromHtml(html);

  assert.strictEqual(result.duration, 300);
});

test('fetchFathomOembed returns null (no public oEmbed endpoint)', async () => {
  // Fathom does not have a public oEmbed endpoint, so this returns null for API parity
  const result = await fetchFathomOembed('https://fathom.video/share/abc123');
  assert.strictEqual(result, null);
});
