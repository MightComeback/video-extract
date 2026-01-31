import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLoomMetadataFromHtml } from '../src/providers/loom.js';

test('extractLoomMetadataFromHtml: extracts MP4 if M3U8/DASH missing', () => {
    const mockState = {
        "RegularUserVideo:123": {
            "name": "MP4 Video",
            "nullableRawCdnUrl({\"acceptableMimes\":[\"MP4\"],\"password\":null})": {
                "url": "https://cdn.loom.com/video.mp4"
            },
            "posterUrl": "https://cdn.loom.com/poster.jpg"
        }
    };
    
    // Wrap in the structure expected by the regex match
    // window.__APOLLO_STATE__ = { ... };
    const html = `
    <html>
    <script>
    window.__APOLLO_STATE__ = ${JSON.stringify(mockState)};
    </script>
    </html>
    `;

    const meta = extractLoomMetadataFromHtml(html);
    assert.equal(meta.title, "MP4 Video");
    assert.equal(meta.mediaUrl, "https://cdn.loom.com/video.mp4");
    assert.equal(meta.thumbnailUrl, "https://cdn.loom.com/poster.jpg");
});

test('extractLoomMetadataFromHtml: extracts date (createdAt)', () => {
    const mockState = {
        "RegularUserVideo:123": {
            "name": "Dated Video",
            "createdAt": "2024-01-01T12:00:00.000Z"
        }
    };
    
    const html = `
    <html>
    <script>
    window.__APOLLO_STATE__ = ${JSON.stringify(mockState)};
    </script>
    </html>
    `;

    const meta = extractLoomMetadataFromHtml(html);
    assert.equal(meta.title, "Dated Video");
    assert.equal(meta.date, "2024-01-01T12:00:00.000Z");
});

test('extractLoomMetadataFromHtml: prefers MP4 over M3U8', () => {
    const mockState = {
        "RegularUserVideo:123": {
            "name": "Mixed Video",
            "nullableRawCdnUrl({\"acceptableMimes\":[\"MP4\"],\"password\":null})": {
                "url": "https://cdn.loom.com/video.mp4"
            },
            "nullableRawCdnUrl({\"acceptableMimes\":[\"M3U8\"],\"password\":null})": {
                "url": "https://cdn.loom.com/video.m3u8"
            }
        }
    };
    
    const html = `
    <html>
    <script>
    window.__APOLLO_STATE__ = ${JSON.stringify(mockState)};
    </script>
    </html>
    `;

    const meta = extractLoomMetadataFromHtml(html);
    assert.equal(meta.mediaUrl, "https://cdn.loom.com/video.mp4");
});
