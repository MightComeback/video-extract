import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractLoomMetadataFromHtml } from '../src/loom.js';

test('extractLoomMetadataFromHtml: falls back to source_url (JSON) if vtt missing', () => {
    const mockState = {
        "VideoTranscriptDetails:123": {
            "source_url": "https://cdn.loom.com/transcript.json",
            "__typename": "VideoTranscriptDetails"
        },
        "RegularUserVideo:XYZ": {
            "id": "XYZ",
            "name": "My Video"
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
    assert.equal(meta.transcriptUrl, "https://cdn.loom.com/transcript.json");
});
