import { test } from 'node:test';
import assert from 'node:assert';
import { isYoutubeUrl, extractYoutubeId, extractYoutubeMetadataFromHtml } from '../src/providers/youtube.js';

test('isYoutubeUrl identifies valid YouTube URLs', () => {
  const valid = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'http://youtube.com/v/dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ',
    // With extra params
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123s'
  ];
  
  valid.forEach(url => {
    assert.strictEqual(isYoutubeUrl(url), true, `Should accept ${url}`);
  });
});

test('isYoutubeUrl rejects invalid URLs', () => {
  const invalid = [
    'https://google.com',
    'https://vimeo.com/123456789',
    'https://youtube.com/watch?v=short', // too short ID
    'youtube.com', // no protocol/path (though my regex might handle this, let's see implementation)
    // The implementation requires strict 11 char ID match for now
    'https://www.youtube.com/about/'
  ];
  
  invalid.forEach(url => {
    assert.strictEqual(isYoutubeUrl(url), false, `Should reject ${url}`);
  });
});

test('extractYoutubeId extracts 11-char ID', () => {
  assert.strictEqual(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.strictEqual(extractYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ?start=1'), 'dQw4w9WgXcQ');
});

test('extractYoutubeMetadataFromHtml parses initial player response', () => {
  // Mock HTML content with ytInitialPlayerResponse
  const mockData = {
    videoDetails: {
      title: 'Rick Roll',
      shortDescription: 'Never gonna give you up',
      lengthSeconds: '212',
      author: 'RickAstley',
      channelId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
      viewCount: '1000000000',
      isLiveContent: false,
      thumbnail: { thumbnails: [{ url: 'thumb.jpg' }] }
    },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          { languageCode: 'es', baseUrl: 'http://example.com/es?fmt=vtt' },
          { languageCode: 'en', baseUrl: 'http://example.com/en', kind: 'asr' }, // Auto-generated
          { languageCode: 'en', baseUrl: 'http://example.com/en-official' }      // Manual
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
  
  assert.ok(meta, 'Should return metadata');
  assert.strictEqual(meta.title, 'Rick Roll');
  assert.strictEqual(meta.duration, 212);
  assert.strictEqual(meta.author, 'RickAstley');
  
  // Verify caption selection logic (English manual > English ASR > First)
  // Our logic: sorts en, then manual. So 'en-official' should win.
  // And it should have &fmt=vtt appended if missing.
  assert.strictEqual(meta.transcriptUrl, 'http://example.com/en-official&fmt=vtt');
});
