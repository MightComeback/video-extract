import { test } from 'node:test';
import assert from 'node:assert';
import { extractTranscriptUrlFromHtml } from '../src/extractor.js';

test('extractTranscriptUrlFromHtml finds Loom VTT', (t) => {
  const html = `
    <html>
      <script>
        window.loom = {
          "video": {
            "captions": {
               "url": "https://cdn.loom.com/sessions/123/transcription.vtt?token=abc"
            }
          }
        }
      </script>
    </html>
  `;
  
  const url = extractTranscriptUrlFromHtml(html, 'https://www.loom.com/share/123');
  assert.equal(url, 'https://cdn.loom.com/sessions/123/transcription.vtt?token=abc');
});

test('extractTranscriptUrlFromHtml finds quoted VTT string in JSON', (t) => {
    // Simulating a more messy JSON state often found in hydration data
    const html = `
      <script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{"video":{"captionsPath":"https://cdn.loom.com/captions/xyz.vtt"}}}}
      </script>
    `;
    const url = extractTranscriptUrlFromHtml(html, 'https://www.loom.com/share/xyz');
    assert.equal(url, 'https://cdn.loom.com/captions/xyz.vtt');
});

test('extractTranscriptUrlFromHtml returns empty if no VTT', (t) => {
    const html = '<html>No captions here</html>';
    const url = extractTranscriptUrlFromHtml(html, 'https://example.com');
    assert.equal(url, '');
});
