import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLoomUrl, extractLoomId, extractLoomMetadataFromHtml } from '../src/loom.js';

test('Loom: URL detection', () => {
  assert.equal(isLoomUrl('https://www.loom.com/share/abcd12345'), true);
  assert.equal(isLoomUrl('https://www.loom.com/v/xyz987'), true);
  assert.equal(isLoomUrl('https://loom.com/share/123'), true);
  assert.equal(isLoomUrl('https://google.com'), false);
});

test('Loom: ID extraction', () => {
  assert.equal(extractLoomId('https://www.loom.com/share/abcd12345'), 'abcd12345');
  assert.equal(extractLoomId('https://www.loom.com/v/xyz987'), 'xyz987');
  assert.equal(extractLoomId('https://loom.com/embed/foo'), 'foo');
});

test('Loom: Metadata from HTML (Apollo State)', () => {
  const mockState = {
    'RegularUserVideo:123': {
      name: 'My Loom Video',
      description: 'A test video',
      duration: 60,
      'nullableRawCdnUrl({"type":"M3U8"})': { url: 'https://cdn.loom.com/video.m3u8' }
    },
    'VideoTranscriptDetails:123': {
      captions_source_url: 'https://cdn.loom.com/captions.vtt'
    }
  };

  const html = `
    <html>
      <head>
        <script>
          window.__APOLLO_STATE__ = ${JSON.stringify(mockState)};
        </script>
      </head>
    </html>
  `;

  const meta = extractLoomMetadataFromHtml(html);
  assert.ok(meta, 'Should extract metadata');
  assert.equal(meta.title, 'My Loom Video');
  assert.equal(meta.description, 'A test video');
  assert.equal(meta.duration, 60);
  assert.equal(meta.mediaUrl, 'https://cdn.loom.com/video.m3u8');
  assert.equal(meta.transcriptUrl, 'https://cdn.loom.com/captions.vtt');
});

test('Loom: Metadata extraction robustness', () => {
    // Test with missing fields
    const mockState = {
        'RegularUserVideo:123': {
            name: 'Partial Video'
        }
    };
    const html = `window.__APOLLO_STATE__ = ${JSON.stringify(mockState)};`;
    const meta = extractLoomMetadataFromHtml(html);
    assert.ok(meta);
    assert.equal(meta.title, 'Partial Video');
    assert.equal(meta.mediaUrl, null);
});
