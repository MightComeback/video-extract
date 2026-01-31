import { test } from 'node:test';
import assert from 'node:assert';
import { extractFromUrl } from '../src/extractor.js';

test('extractFromUrl uses transcript from Loom session if available', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => global.fetch = originalFetch);

  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('loom.com/share/')) {
        return {
            ok: true,
            text: async () => '<html><head><title>Loom Video</title></head><body>No transcript in HTML</body></html>',
            headers: new Map()
        };
    }
    if (u.includes('/api/campaigns/sessions/')) {
        return {
            ok: true,
            json: async () => ({
                name: 'My Loom Video',
                description: 'A description',
                // Mimic what findTranscriptInObject looks for (e.g. "transcripts" array)
                transcripts: [
                    {
                        text: "This is a transcript from the API.",
                        speaker: "Speaker",
                        start: 0
                    },
                     {
                        text: "It works.",
                        speaker: "Speaker",
                        start: 5
                    }
                ]
            }),
            headers: new Map()
        };
    }
    if (u.includes('oembed')) {
         return {
            ok: true,
            json: async () => ({ title: 'My Loom Video', author_name: 'Author' }),
            headers: new Map()
        };
    }
    return { ok: false, status: 404, headers: new Map() };
  };

  const result = await extractFromUrl('https://www.loom.com/share/abc1234567890abcdef1234567890abc');
  assert.ok(result.text.includes('This is a transcript from the API'));
  assert.ok(result.text.includes('It works'));
});
