import { test } from 'node:test';
import assert from 'node:assert';
import { isVimeoUrl, extractVimeoId, extractVimeoMetadataFromHtml } from '../src/providers/vimeo.js';

test('isVimeoUrl identifies Vimeo URLs', () => {
  assert.ok(isVimeoUrl('https://vimeo.com/123456789'));
  assert.ok(isVimeoUrl('https://vimeo.com/channels/staffpicks/123456789'));
  assert.ok(isVimeoUrl('vimeo.com/123456789'));
  
  assert.equal(isVimeoUrl('https://youtube.com/watch?v=123'), false);
  assert.equal(isVimeoUrl('https://example.com'), false);
});

test('extractVimeoId extracts numeric ID', () => {
  assert.equal(extractVimeoId('https://vimeo.com/123456789'), '123456789');
  assert.equal(extractVimeoId('https://vimeo.com/channels/staffpicks/987654321'), '987654321');
});

test('extractVimeoMetadataFromHtml parses config object', () => {
  const html = `
    <html>
      <head>
        <meta property="og:description" content="Meta Description">
      </head>
      <body>
        <script>
          window.vimeo.clip_page_config = { 
            "clip": { 
              "name": "Config Title", 
              "duration": {"raw": 120}, 
              "poster": {"display_src": "https://example.com/thumb.jpg"} 
            }, 
            "request": { 
              "files": { 
                "progressive": [
                  {"url": "https://example.com/video_720.mp4", "width": 720},
                  {"url": "https://example.com/video_1080.mp4", "width": 1080}
                ] 
              } 
            } 
          };
        </script>
      </body>
    </html>
  `;

  const meta = extractVimeoMetadataFromHtml(html);
  assert.equal(meta.title, 'Config Title');
  assert.equal(meta.description, 'Meta Description');
  assert.equal(meta.duration, 120);
  assert.equal(meta.thumbnailUrl, 'https://example.com/thumb.jpg');
  assert.equal(meta.mediaUrl, 'https://example.com/video_1080.mp4');
});
