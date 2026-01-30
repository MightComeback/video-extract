import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeFetchedContent } from '../src/extractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Golden input: normalizeFetchedContent extracts title, media, and transcript correctly', async (t) => {
  const fixturePath = path.join(__dirname, 'fixtures/fathom-share.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  // Act
  const result = normalizeFetchedContent(html, 'https://fathom.video/share/golden');

  // Assert
  // Title should match <title>
  assert.strictEqual(result.suggestedTitle, 'Golden Test Video Title');
  
  // Media URL should be extracted from og:video or JSON-LD
  assert.strictEqual(result.mediaUrl, 'https://cdn.example.com/video.mp4');

  // Transcript should be extracted from JSON-LD
  // Note: the extractor logic for JSON-LD "transcript" field just returns the string.
  assert.ok(result.text.includes('Alice: Hello world.'), 'Transcript contains Alice');
  assert.ok(result.text.includes('Bob: Hi Alice.'), 'Transcript contains Bob');
});
