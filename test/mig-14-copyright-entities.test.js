import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeFetchedContent } from '../src/extractor.js';

test('MIG-14: normalizeFetchedContent decodes copyright/trademark entities in title', (t) => {
  const html = `
    <html>
      <head>
        <title>BrandName&trade; Video &copy; 2024 &reg;</title>
      </head>
      <body></body>
    </html>
  `;
  const result = normalizeFetchedContent(html);
  // Expected: BrandName™ Video © 2024 ®
  assert.equal(result.suggestedTitle, 'BrandName™ Video © 2024 ®');
});
