import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrlLike } from '../src/brief.js';

test('normalizeUrlLike handles basic URLs', () => {
  assert.equal(normalizeUrlLike('https://example.com'), 'https://example.com');
  assert.equal(normalizeUrlLike('http://example.com'), 'http://example.com');
  assert.equal(normalizeUrlLike('  https://example.com  '), 'https://example.com');
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
  assert.equal(normalizeUrlLike('https://youtu.be/abc123?t=30'), 'https://youtube.com/watch?v=abc123&t=30');
  assert.equal(
    normalizeUrlLike('https://www.youtube.com/watch?v=abc123&feature=youtu.be'),
    'https://youtube.com/watch?v=abc123'
  );
  assert.equal(normalizeUrlLike('https://youtube.com/shorts/abc123?si=xyz'), 'https://youtube.com/watch?v=abc123');

  assert.equal(normalizeUrlLike('https://loom.com/embed/1234abcd'), 'https://loom.com/share/1234abcd');
  assert.equal(normalizeUrlLike('https://www.loom.com/v/abc-123'), 'https://loom.com/share/abc-123');
  assert.equal(normalizeUrlLike('https://www.loom.com/recording/abc-123'), 'https://loom.com/share/abc-123');

  assert.equal(normalizeUrlLike('https://player.vimeo.com/video/12345?h=abc'), 'https://vimeo.com/12345?h=abc');
});
