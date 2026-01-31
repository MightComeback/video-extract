import { test } from 'node:test';
import assert from 'node:assert';
import { extractVimeoMetadataFromHtml } from '../src/vimeo.js';

test('extractVimeoMetadataFromHtml extracts description from OG tags', () => {
  // Use valid JSON for config
  const config = { clip: { name: 'Title' } };
  const html = `
    <html>
      <meta property="og:description" content="This is a vimeo video description from OG.">
      <script>
        window.vimeo = window.vimeo || {};
        window.vimeo.clip_page_config = ${JSON.stringify(config)};
      </script>
    </html>
  `;
  
  const result = extractVimeoMetadataFromHtml(html);
  
  assert.ok(result);
  assert.strictEqual(result.title, 'Title');
  assert.strictEqual(result.description, 'This is a vimeo video description from OG.');
});

test('extractVimeoMetadataFromHtml works without config if meta tags present', () => {
    const html = `
      <html>
        <meta property="og:title" content="Meta Title">
        <meta property="og:description" content="Meta Description">
      </html>
    `;
    
    const result = extractVimeoMetadataFromHtml(html);
    assert.ok(result);
    assert.strictEqual(result.title, 'Meta Title');
    assert.strictEqual(result.description, 'Meta Description');
});
