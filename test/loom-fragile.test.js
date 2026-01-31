import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractLoomMetadataFromHtml } from '../src/providers/loom.js';

test('extractLoomMetadataFromHtml handles } inside strings', () => {
    // A fake Apollo state where a string contains "};" which might trick the regex
    const fakeState = {
        "RegularUserVideo:123": {
            "name": "Video with tricky characters",
            "description": "This description has a closing brace and semicolon }; inside it.",
            "nullableRawCdnUrl": { "url": "https://example.com/video.mp4" }
        }
    };
    const json = JSON.stringify(fakeState);
    const html = `
        <html>
        <script>
            window.__APOLLO_STATE__ = ${json};
        </script>
        </html>
    `;

    const meta = extractLoomMetadataFromHtml(html);
    assert.notEqual(meta, null, 'Should extract metadata');
    assert.equal(meta.title, "Video with tricky characters");
    assert.equal(meta.description, "This description has a closing brace and semicolon }; inside it.");
});
