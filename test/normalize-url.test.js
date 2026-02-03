import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrlLike } from '../src/brief.js';

test('normalizeUrlLike handles basic URLs', () => {
  assert.equal(normalizeUrlLike('https://example.com'), 'https://example.com');
  assert.equal(normalizeUrlLike('http://example.com'), 'http://example.com');
  assert.equal(normalizeUrlLike('  https://example.com  '), 'https://example.com');
  // Provider parity: accept protocol-relative URLs too.
  assert.equal(normalizeUrlLike('//example.com/path?q=1'), 'https://example.com/path?q=1');
});

test('normalizeUrlLike strips common prefixes', () => {
  assert.equal(normalizeUrlLike('Source: https://example.com'), 'https://example.com');
  assert.equal(normalizeUrlLike('Link: https://example.com'), 'https://example.com');
  assert.equal(normalizeUrlLike('URL: https://example.com'), 'https://example.com');
  // Case insensitive
  assert.equal(normalizeUrlLike('source: https://example.com'), 'https://example.com');
  
  // Specific prefixes mentioned in code or common usage
  assert.equal(normalizeUrlLike('Fathom: https://example.com'), 'https://example.com');
  assert.equal(normalizeUrlLike('Video: https://example.com'), 'https://example.com');
  assert.equal(normalizeUrlLike('Recording: https://example.com'), 'https://example.com');
  assert.equal(normalizeUrlLike('YouTube: https://example.com'), 'https://example.com');
  assert.equal(normalizeUrlLike('Vimeo: https://example.com'), 'https://example.com');
});

test('normalizeUrlLike handles angle brackets and slack style', () => {
  assert.equal(normalizeUrlLike('<https://example.com>'), 'https://example.com');
  assert.equal(normalizeUrlLike('<https://example.com|Label>'), 'https://example.com');
  assert.equal(normalizeUrlLike('< https://example.com >'), 'https://example.com');
  // Trailing punctuation after bracket
  assert.equal(normalizeUrlLike('<https://example.com>),'), 'https://example.com');
});

test('normalizeUrlLike handles markdown', () => {
  assert.equal(normalizeUrlLike('[Label](https://example.com)'), 'https://example.com');
  assert.equal(normalizeUrlLike('[Label]( https://example.com )'), 'https://example.com');
  // Trailing punctuation after markdown
  assert.equal(normalizeUrlLike('[Label](https://example.com).'), 'https://example.com');

  // Provider parity: accept Loom share subdomain inside markdown links.
  assert.equal(
    normalizeUrlLike('[Loom](https://share.loom.com/share/1234abcd)'),
    'https://loom.com/share/1234abcd'
  );
});

test('normalizeUrlLike handles trailing punctuation on bare URLs', () => {
  assert.equal(normalizeUrlLike('https://example.com.'), 'https://example.com');
  assert.equal(normalizeUrlLike('https://example.com,'), 'https://example.com');
  assert.equal(normalizeUrlLike('(https://example.com)'), 'https://example.com');
  assert.equal(normalizeUrlLike('https://example.com?'), 'https://example.com');
  assert.equal(normalizeUrlLike('https://example.com!'), 'https://example.com');
  // Combinations
  assert.equal(normalizeUrlLike('"https://example.com"'), 'https://example.com');
});

test('normalizeUrlLike handles copy-paste quotes', () => {
  assert.equal(normalizeUrlLike('> https://example.com'), 'https://example.com');
  assert.equal(normalizeUrlLike('>> https://example.com'), 'https://example.com');
  assert.equal(normalizeUrlLike('>>> Source: https://example.com'), 'https://example.com');
});

test('normalizeUrlLike handles unusual brackets', () => {
  assert.equal(normalizeUrlLike('{https://example.com}'), 'https://example.com');
  assert.equal(normalizeUrlLike('{{https://example.com}}'), 'https://example.com');
});


test('normalizeUrlLike canonicalizes common provider URL variants', () => {
  const id = 'dQw4w9WgXcQ';

  assert.equal(normalizeUrlLike(`https://youtu.be/${id}?t=30`), `https://youtube.com/watch?v=${id}&t=30`);
  // Provider parity: accept protocol-relative URLs too.
  assert.equal(normalizeUrlLike(`//youtu.be/${id}?t=30`), `https://youtube.com/watch?v=${id}&t=30`);
  assert.equal(normalizeUrlLike(`https://youtu.be/${id}#t=1m2s`), `https://youtube.com/watch?v=${id}&t=1m2s`);
  assert.equal(normalizeUrlLike(`https://youtu.be/${id}#start=62`), `https://youtube.com/watch?v=${id}&t=62`);
  assert.equal(normalizeUrlLike(`https://www.youtube.com/watch?v=${id}&feature=youtu.be`), `https://youtube.com/watch?v=${id}`);
  // Provider parity: accept /watch/ (some share flows include a trailing slash).
  assert.equal(normalizeUrlLike(`https://www.youtube.com/watch/?v=${id}&feature=share`), `https://youtube.com/watch?v=${id}`);
  // Provider parity: tolerate HTML-escaped query separators from copy/paste.
  assert.equal(normalizeUrlLike(`https://www.youtube.com/watch?v=${id}&amp;t=30`), `https://youtube.com/watch?v=${id}&t=30`);

  // Clip URLs: normalize host + strip tracking params (even though we can't resolve a stable video id).
  assert.equal(
    normalizeUrlLike('https://www.youtube.com/clip/UgkxyZKk3VwzExampleClipId?feature=share'),
    'https://youtube.com/clip/UgkxyZKk3VwzExampleClipId'
  );
  assert.equal(
    normalizeUrlLike(
      `https://www.youtube.com/attribution_link?u=%2Fwatch%3Fv%3D${id}%26t%3D30s%26feature%3Dshare&a=foo`
    ),
    `https://youtube.com/watch?v=${id}&t=30s`
  );

  // Some mobile shares double-encode the inner URL.
  assert.equal(
    normalizeUrlLike(
      `https://www.youtube.com/attribution_link?u=%252Fwatch%253Fv%253D${id}%2526t%253D30s%2526feature%253Dshare&a=foo`
    ),
    `https://youtube.com/watch?v=${id}&t=30s`
  );
  assert.equal(normalizeUrlLike(`https://youtube.com/shorts/${id}?si=xyz`), `https://youtube.com/watch?v=${id}`);
  assert.equal(normalizeUrlLike(`https://youtube.com/@SomeChannel/shorts/${id}?feature=share`), `https://youtube.com/watch?v=${id}`);
  assert.equal(normalizeUrlLike(`https://youtube.com/@SomeChannel/live/${id}?t=30`), `https://youtube.com/watch?v=${id}&t=30`);
  assert.equal(normalizeUrlLike(`https://youtube.com/v/${id}`), `https://youtube.com/watch?v=${id}`);
  assert.equal(normalizeUrlLike(`https://www.youtube-nocookie.com/embed/${id}`), `https://youtube.com/watch?v=${id}`);
  assert.equal(normalizeUrlLike(`youtube-nocookie.com/embed/${id}`), `https://youtube.com/watch?v=${id}`);

  // Invalid / non-YouTube IDs should not be forced into a canonical watch URL.
  assert.equal(normalizeUrlLike('https://youtu.be/abc123?t=30'), 'https://youtu.be/abc123?t=30');
  assert.equal(normalizeUrlLike('https://youtube.com/shorts/abc123?si=xyz'), 'https://youtube.com/shorts/abc123?si=xyz');

  assert.equal(normalizeUrlLike('https://loom.com/embed/1234abcd'), 'https://loom.com/share/1234abcd');
  assert.equal(
    normalizeUrlLike('https://www.loom.com/share/1234abcd?sid=deadbeef&utm_source=share'),
    'https://loom.com/share/1234abcd?sid=deadbeef'
  );
  assert.equal(
    normalizeUrlLike('https://www.loom.com/share/1234abcd?sid=deadbeef&t=62&utm_source=share'),
    'https://loom.com/share/1234abcd?sid=deadbeef&t=62'
  );
  assert.equal(
    normalizeUrlLike('https://www.loom.com/share/1234abcd#t=62'),
    'https://loom.com/share/1234abcd?t=62'
  );
  assert.equal(
    normalizeUrlLike('https://www.loom.com/share/1234abcd#start=62'),
    'https://loom.com/share/1234abcd?t=62'
  );
  assert.equal(normalizeUrlLike('https://share.loom.com/share/1234abcd'), 'https://loom.com/share/1234abcd');
  assert.equal(normalizeUrlLike('//share.loom.com/share/1234abcd'), 'https://loom.com/share/1234abcd');
  assert.equal(normalizeUrlLike('share.loom.com/share/1234abcd'), 'https://loom.com/share/1234abcd');
  // Provider parity: accept bare player.loom.com links (no scheme) in chat copy/paste.
  assert.equal(normalizeUrlLike('player.loom.com/share/1234abcd'), 'https://loom.com/share/1234abcd');
  assert.equal(normalizeUrlLike('[Loom](player.loom.com/share/1234abcd)'), 'https://loom.com/share/1234abcd');
  assert.equal(normalizeUrlLike('https://www.loom.com/v/abc-123'), 'https://loom.com/share/abc-123');
  assert.equal(normalizeUrlLike('https://www.loom.com/recording/abc-123'), 'https://loom.com/share/abc-123');
  assert.equal(normalizeUrlLike('https://www.loom.com/i/abc_123'), 'https://loom.com/share/abc_123');
  assert.equal(normalizeUrlLike('https://www.loom.com/s/abc_123'), 'https://loom.com/share/abc_123');

  assert.equal(normalizeUrlLike('https://player.vimeo.com/video/12345?h=abc'), 'https://vimeo.com/12345?h=abc');
  assert.equal(normalizeUrlLike('//player.vimeo.com/video/12345?h=abc'), 'https://vimeo.com/12345?h=abc');
  // Provider parity: accept bare player.vimeo.com links (no scheme) in chat copy/paste.
  assert.equal(normalizeUrlLike('player.vimeo.com/video/12345?h=abc'), 'https://vimeo.com/12345?h=abc');
  assert.equal(normalizeUrlLike('[Vimeo](player.vimeo.com/video/12345?h=abc)'), 'https://vimeo.com/12345?h=abc');
  assert.equal(normalizeUrlLike('https://vimeo.com/12345/abcdef'), 'https://vimeo.com/12345?h=abcdef');
  assert.equal(normalizeUrlLike('https://player.vimeo.com/video/12345/abcdef'), 'https://vimeo.com/12345?h=abcdef');
  assert.equal(normalizeUrlLike('https://vimeo.com/12345#t=62'), 'https://vimeo.com/12345#t=62');
  assert.equal(normalizeUrlLike('https://vimeo.com/12345?t=1m2s'), 'https://vimeo.com/12345#t=1m2s');
  assert.equal(normalizeUrlLike('https://vimeo.com/12345?start=62&amp;foo=bar'), 'https://vimeo.com/12345#t=62');
  assert.equal(normalizeUrlLike('https://vimeo.com/12345?start=62'), 'https://vimeo.com/12345#t=62');
  assert.equal(normalizeUrlLike('https://vimeo.com/12345#start=62'), 'https://vimeo.com/12345#t=62');
  assert.equal(normalizeUrlLike('https://vimeo.com/channels/staffpicks/12345'), 'https://vimeo.com/12345');
  // Provider parity: preserve unlisted hash tokens even when they appear on channel/showcase routes.
  assert.equal(normalizeUrlLike('https://vimeo.com/channels/staffpicks/12345/abcdef'), 'https://vimeo.com/12345?h=abcdef');
  // Provider parity: normalize additional common Vimeo collection routes.
  assert.equal(normalizeUrlLike('https://vimeo.com/groups/animation/videos/12345'), 'https://vimeo.com/12345');
  assert.equal(normalizeUrlLike('https://vimeo.com/album/2222/video/12345'), 'https://vimeo.com/12345');

  // Correctness: showcases are collections; the showcase root URL is not a clip.
  assert.equal(normalizeUrlLike('https://vimeo.com/showcase/12345'), 'https://vimeo.com/showcase/12345');
  assert.equal(normalizeUrlLike('https://vimeo.com/showcase/12345/'), 'https://vimeo.com/showcase/12345/');
  // But if the showcase URL references a specific video, normalize to that video id.
  assert.equal(normalizeUrlLike('https://vimeo.com/showcase/12345/video/67890'), 'https://vimeo.com/67890');
  assert.equal(normalizeUrlLike('https://staffpicks.vimeo.com/12345'), 'https://vimeo.com/12345');
  assert.equal(normalizeUrlLike('staffpicks.vimeo.com/12345'), 'https://vimeo.com/12345');
  assert.equal(normalizeUrlLike('https://vimeo.com/ondemand/somefilm/987654321'), 'https://vimeo.com/987654321');
  assert.equal(normalizeUrlLike('https://vimeo.com/manage/videos/987654321'), 'https://vimeo.com/987654321');
  // Avoid false positives: non-video sections should not be normalized into fake IDs.
  assert.equal(
    normalizeUrlLike('https://vimeo.com/blog/post/2026/02/03/some-announcement'),
    'https://vimeo.com/blog/post/2026/02/03/some-announcement'
  );
  assert.equal(normalizeUrlLike('https://vimeo.com/event/123456'), 'https://vimeo.com/event/123456');
  assert.equal(normalizeUrlLike('https://vimeo.com/events/123456'), 'https://vimeo.com/events/123456');

  // Provider parity: accept any YouTube subdomain for bare links too.
  assert.equal(normalizeUrlLike(`gaming.youtube.com/watch?v=${id}`), `https://youtube.com/watch?v=${id}`);
  assert.equal(normalizeUrlLike(`m.youtube.com/watch?v=${id}`), `https://youtube.com/watch?v=${id}`);
  assert.equal(normalizeUrlLike(`music.youtube.com/watch?v=${id}`), `https://youtube.com/watch?v=${id}`);
});
