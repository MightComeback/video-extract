import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractYoutubeMetadataFromHtml } from '../src/youtube.js';

test('extractYoutubeMetadataFromHtml: extracts title, description, transcript URL', () => {
  const mockData = {
    videoDetails: {
      title: 'Rick Astley - Never Gonna Give You Up',
      shortDescription: 'The official video.',
      lengthSeconds: '213',
      author: 'Rick Astley',
      viewCount: '1000000',
      isLiveContent: false
    },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            baseUrl: 'https://www.youtube.com/api/timedtext?v=dQw4w9WgXcQ&lang=en',
            name: { simpleText: 'English' },
            vssId: '.en',
            languageCode: 'en',
            kind: 'standard',
            isTranslatable: true
          }
        ]
      }
    }
  };

  const html = `
    <html>
      <script>
        var ytInitialPlayerResponse = ${JSON.stringify(mockData)};
      </script>
    </html>
  `;

  const meta = extractYoutubeMetadataFromHtml(html);
  assert.ok(meta);
  assert.equal(meta.title, 'Rick Astley - Never Gonna Give You Up');
  assert.equal(meta.description, 'The official video.');
  assert.equal(meta.author, 'Rick Astley');
  assert.equal(meta.duration, 213);
  
  // Should append &fmt=vtt
  assert.ok(meta.transcriptUrl.includes('fmt=vtt'));
  assert.ok(meta.transcriptUrl.startsWith('https://www.youtube.com/api/timedtext'));
});

test('extractYoutubeMetadataFromHtml: prefers English captions', () => {
  const mockData = {
    videoDetails: { title: 'Test' },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            baseUrl: 'https://example.com/es',
            languageCode: 'es',
            kind: 'standard'
          },
          {
            baseUrl: 'https://example.com/en',
            languageCode: 'en',
            kind: 'standard'
          }
        ]
      }
    }
  };

  const html = `var ytInitialPlayerResponse = ${JSON.stringify(mockData)};`;
  const meta = extractYoutubeMetadataFromHtml(html);
  assert.ok(meta.transcriptUrl.includes('/en'));
});

test('extractYoutubeMetadataFromHtml: extracts channelId and thumbnail', () => {
  const mockData = {
    videoDetails: {
      channelId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
      thumbnail: {
        thumbnails: [
          { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg', width: 120, height: 90 },
          { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', width: 480, height: 360 }
        ]
      }
    }
  };

  const html = `var ytInitialPlayerResponse = ${JSON.stringify(mockData)};`;
  const meta = extractYoutubeMetadataFromHtml(html);
  assert.equal(meta.channelId, 'UCuAXFkgsw1L7xaCfnd5JJOw');
  assert.equal(meta.thumbnailUrl, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
});
