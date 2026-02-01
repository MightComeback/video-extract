import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { extractYoutubeMetadataFromHtml } from '../src/providers/youtube.js';

test('extractYoutubeMetadataFromHtml extracts from fixture', () => {
  const fixturePath = path.join(process.cwd(), 'test', 'fixtures', 'youtube-watch.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  
  const meta = extractYoutubeMetadataFromHtml(html);
  
  assert.ok(meta, 'Metadata should be extracted');
  assert.strictEqual(meta.title, 'Me at the zoo', 'Title match');
  assert.strictEqual(meta.description, 'The first video on YouTube.', 'Description match');
  assert.strictEqual(meta.duration, 19, 'Duration match');
  assert.strictEqual(meta.author, 'jawed', 'Author match');
  assert.strictEqual(meta.channelId, 'UC4QZ_Zs', 'Channel ID match');
  assert.strictEqual(meta.viewCount, 300000000, 'View count match');
  assert.strictEqual(meta.date, '2005-04-23', 'Date match');
  assert.strictEqual(meta.isLive, false, 'isLive match');
  assert.match(meta.thumbnailUrl, /i\.ytimg\.com/, 'Thumbnail match');
  
  // Transcript logic adds &fmt=vtt
  assert.ok(meta.transcriptUrl.includes('lang=en'), 'Transcript lang match');
  assert.ok(meta.transcriptUrl.includes('fmt=vtt'), 'Transcript format match');
});
