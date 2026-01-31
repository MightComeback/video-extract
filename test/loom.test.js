import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isLoomUrl, extractLoomId, extractLoomMetadataFromHtml } from '../src/providers/loom.js';

describe('Loom Support', () => {
  it('detects valid loom URLs', () => {
    assert.strictEqual(isLoomUrl('https://www.loom.com/share/12345'), true);
    assert.strictEqual(isLoomUrl('https://loom.com/v/abc-def'), true);
    assert.strictEqual(isLoomUrl('https://www.loom.com/embed/xyz'), true);
    assert.strictEqual(isLoomUrl('https://google.com'), false);
  });

  it('extracts loom IDs', () => {
    assert.strictEqual(extractLoomId('https://www.loom.com/share/my-id-123'), 'my-id-123');
    assert.strictEqual(extractLoomId('https://loom.com/v/another-id'), 'another-id');
    assert.strictEqual(extractLoomId('https://www.loom.com/embed/embed-id'), 'embed-id');
  });

  it('extracts metadata from Apollo state', () => {
    // Minimal mock of the structure we expect
    const state = {
      'RegularUserVideo:123': {
        name: 'Test Loom Video',
        description: 'A test video description.',
        duration: 60,
        createdAt: '2023-01-01T00:00:00Z',
        owner: { __ref: 'User:456' },
        'nullableRawCdnUrl({"arg":"MP4"})': { url: 'https://cdn.loom.com/file.mp4' }
      },
      'User:456': {
        fullName: 'Jane Doe'
      }
    };
    
    const html = `
      <html>
        <script>
          window.__APOLLO_STATE__ = ${JSON.stringify(state)};
        </script>
      </html>
    `;

    const meta = extractLoomMetadataFromHtml(html);
    assert.ok(meta);
    assert.strictEqual(meta.title, 'Test Loom Video');
    assert.strictEqual(meta.description, 'A test video description.');
    assert.strictEqual(meta.mediaUrl, 'https://cdn.loom.com/file.mp4');
    assert.strictEqual(meta.author, 'Jane Doe');
    assert.strictEqual(meta.duration, 60);
    assert.strictEqual(meta.date, '2023-01-01T00:00:00Z');
  });

  it('handles missing Apollo state gracefully', () => {
    const meta = extractLoomMetadataFromHtml('<html><body>No data here</body></html>');
    assert.strictEqual(meta, null);
  });
});
