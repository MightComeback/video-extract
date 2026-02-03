import { test } from 'node:test';
import assert from 'node:assert';
import { isVimeoUrl, extractVimeoId, extractVimeoMetadataFromHtml } from '../src/providers/vimeo.js';

test('isVimeoUrl identifies Vimeo URLs', () => {
  assert.ok(isVimeoUrl('https://vimeo.com/123456789'));
  assert.ok(isVimeoUrl('https://vimeo.com/channels/staffpicks/123456789'));
  assert.ok(isVimeoUrl('https://vimeo.com/showcase/12345/video/123456789'));
  assert.ok(isVimeoUrl('https://vimeo.com/manage/videos/123456789'));
  assert.ok(isVimeoUrl('vimeo.com/123456789'));
  assert.ok(isVimeoUrl('https://player.vimeo.com/video/123456789'));
  // Older/smaller numeric IDs should still be recognized.
  assert.ok(isVimeoUrl('https://player.vimeo.com/video/12345'));
  // Provider parity: unlisted Vimeo URLs include a non-numeric hash segment.
  assert.ok(isVimeoUrl('https://vimeo.com/123456789/abcdef1234'));

  // Provider parity: avoid false positives for non-video Vimeo pages with date-like paths.
  assert.equal(isVimeoUrl('https://vimeo.com/blog/post/2026/02/03/some-article'), false);

  // Avoid false positives for Vimeo events (not a clip URL).
  assert.equal(isVimeoUrl('https://vimeo.com/event/123456'), false);

  assert.equal(isVimeoUrl('https://youtube.com/watch?v=123'), false);
  assert.equal(isVimeoUrl('https://example.com'), false);
});

test('extractVimeoId extracts numeric ID', () => {
  assert.equal(extractVimeoId('https://vimeo.com/123456789'), '123456789');
  assert.equal(extractVimeoId('https://vimeo.com/channels/staffpicks/987654321'), '987654321');
  assert.equal(extractVimeoId('https://vimeo.com/showcase/12345/video/123456789'), '123456789');
  assert.equal(extractVimeoId('https://vimeo.com/manage/videos/123456789'), '123456789');
  assert.equal(extractVimeoId('https://player.vimeo.com/video/555666777'), '555666777');
  assert.equal(extractVimeoId('https://player.vimeo.com/video/12345'), '12345');
  assert.equal(extractVimeoId('https://vimeo.com/123456789/abcdef1234'), '123456789');

  assert.equal(extractVimeoId('https://vimeo.com/blog/post/2026/02/03/some-article'), null);
  assert.equal(extractVimeoId('https://vimeo.com/event/123456'), null);
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
