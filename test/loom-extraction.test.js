import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLoomMetadataFromHtml } from '../src/loom.js';

test('extractLoomMetadataFromHtml: extracts MP4 if M3U8/DASH missing', () => {
    const mockState = {
        "RegularUserVideo:123": {
            "name": "MP4 Video",
            "nullableRawCdnUrl({\"acceptableMimes\":[\"MP4\"],\"password\":null})": {
                "url": "https://cdn.loom.com/video.mp4"
            }
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
});
