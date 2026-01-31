import { test } from 'node:test';
import assert from 'node:assert';
import { extractVimeoMetadataFromHtml } from '../src/providers/vimeo.js';

test('extractVimeoMetadataFromHtml extracts metadata from clip_page_config', () => {
  const mockConfig = {
    clip: {
      name: 'Vimeo Test',
      duration: { raw: 120 },
      poster: { display_src: 'https://cdn.vimeo.com/poster.jpg' }
    },
    owner: {
      display_name: 'Vimeo User',
    },
    request: {
      files: {
        progressive: [
          { url: 'https://cdn.vimeo.com/video.mp4', width: 1920, quality: '1080p' },
          { url: 'https://cdn.vimeo.com/video-sm.mp4', width: 640, quality: '360p' }
        ]
      },
      text_tracks: [
        { url: 'https://cdn.vimeo.com/subs.vtt', lang: 'en' }
      ]
    }
  };
  
  const html = `
    <html>
      <script>
        window.vimeo = window.vimeo || {};
        window.vimeo.clip_page_config = ${JSON.stringify(mockConfig)};
      </script>
    </html>
  `;
  
  const result = extractVimeoMetadataFromHtml(html);
  
  assert.ok(result);
  assert.strictEqual(result.title, 'Vimeo Test');
  assert.strictEqual(result.duration, 120);
  assert.strictEqual(result.author, 'Vimeo User');
  assert.strictEqual(result.thumbnailUrl, 'https://cdn.vimeo.com/poster.jpg');
  assert.strictEqual(result.mediaUrl, 'https://cdn.vimeo.com/video.mp4'); // Should pick highest width
  assert.strictEqual(result.transcriptUrl, 'https://cdn.vimeo.com/subs.vtt');
});

test('extractVimeoMetadataFromHtml returns null if config missing', () => {
    assert.strictEqual(extractVimeoMetadataFromHtml('<html></html>'), null);
});
