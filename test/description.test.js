import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeFetchedContent } from '../src/extractor.js';

test('normalizeFetchedContent extracts description from meta tags', (t) => {
  const html = `
    <html>
      <head>
        <title>Test Title</title>
        <meta name="description" content="Meta description content">
        <meta property="og:description" content="OG description content">
      </head>
      <body>
        <h1>Heading</h1>
      </body>
    </html>
  `;

  const result = normalizeFetchedContent(html);
  // OG takes precedence over name="description" usually, but check implementation order:
  // og:description -> twitter:description -> description
  assert.strictEqual(result.description, 'OG description content');
});

test('normalizeFetchedContent extracts description from name="description" fallback', (t) => {
  const html = `
    <html>
      <head>
        <title>Test Title</title>
        <meta name="description" content="Fallback description">
      </head>
      <body></body>
    </html>
  `;

  const result = normalizeFetchedContent(html);
  assert.strictEqual(result.description, 'Fallback description');
});
