import assert from 'node:assert/strict';
import test from 'node:test';

import { extractYoutubeIdFromClipHtml } from '../src/providers/youtube.js';

test('extractYoutubeIdFromClipHtml extracts id from watchEndpoint payload', () => {
  const id = 'dQw4w9WgXcQ';
  const html = `<!doctype html><html><head></head><body>
    <script>
      window.__data = {"watchEndpoint":{"videoId":"${id}","params":"EgZjbGlw"}};
    </script>
  </body></html>`;

  assert.equal(extractYoutubeIdFromClipHtml(html), id);
});

test('extractYoutubeIdFromClipHtml tolerates nested objects inside watchEndpoint', () => {
  const id = 'dQw4w9WgXcQ';
  const html = `<!doctype html><html><head></head><body>
    <script>
      window.__data = {
        "watchEndpoint": {
          "foo": {"bar": 1},
          "videoId": "${id}",
          "params": "EgZjbGlw"
        }
      };
    </script>
  </body></html>`;

  assert.equal(extractYoutubeIdFromClipHtml(html), id);
});

test('extractYoutubeIdFromClipHtml extracts id from canonicalBaseUrl (JSON-escaped)', () => {
  const id = 'dQw4w9WgXcQ';
  const html = `<!doctype html><html><head></head><body>
    <script>
      window.__data = {"canonicalBaseUrl":"\\/watch?v=${id}"};
    </script>
  </body></html>`;

  assert.equal(extractYoutubeIdFromClipHtml(html), id);
});
