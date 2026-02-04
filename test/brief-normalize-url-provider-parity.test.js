import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrlLike } from '../src/brief.js';

describe('normalizeUrlLike - provider parity', () => {
  test('canonicalizes Vimeo player embed URLs (drops embed params, keeps time)', () => {
    assert.equal(
      normalizeUrlLike(
        'https://player.vimeo.com/video/12345?badge=0&autopause=0&player_id=0&app_id=58479#t=1m2s'
      ),
      'https://vimeo.com/12345#t=1m2s'
    );
  });

  test('canonicalizes YouTube attribution_link URLs (decodes inner watch URL + keeps time)', () => {
    assert.equal(
      normalizeUrlLike(
        'https://www.youtube.com/attribution_link?u=%2Fwatch%3Fv%3DdQw4w9WgXcQ%26t%3D30s%26feature%3Dshare'
      ),
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s'
    );
  });

  test('canonicalizes double-encoded YouTube attribution_link URLs', () => {
    assert.equal(
      normalizeUrlLike(
        'https://www.youtube.com/attribution_link?u=%252Fwatch%253Fv%253DdQw4w9WgXcQ%2526t%253D1m2s'
      ),
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=1m2s'
    );
  });

  test('canonicalizes Vimeo player embed URLs (preserves unlisted hash + time)', () => {
    assert.equal(
      normalizeUrlLike(
        'https://player.vimeo.com/video/12345?h=abcdef&badge=0#t=90s'
      ),
      'https://vimeo.com/12345?h=abcdef#t=90s'
    );
  });

  test('canonicalizes Loom embed URLs (preserves sid + timestamp deep-link)', () => {
    assert.equal(
      normalizeUrlLike(
        'https://www.loom.com/embed/abcdEFGHijk?sid=deadbeef#t=30s'
      ),
      'https://loom.com/share/abcdEFGHijk?sid=deadbeef&t=30s'
    );
  });

  test('canonicalizes bare Loom share URLs (normalizes to /share/<id>)', () => {
    assert.equal(
      normalizeUrlLike('https://loom.com/abcdEFGHijk'),
      'https://loom.com/share/abcdEFGHijk'
    );
  });

  test('does not canonicalize Vimeo review URLs (must preserve token)', () => {
    assert.equal(
      normalizeUrlLike(
        'https://vimeo.com/123456789/review/abcdef123456/abcdef1234?utm_source=x#t=10s'
      ),
      'https://vimeo.com/123456789/review/abcdef123456/abcdef1234#t=10s'
    );
  });

  test('canonicalizes Vimeo dashboard manage/videos URLs', () => {
    assert.equal(
      normalizeUrlLike('https://vimeo.com/manage/videos/12345/advanced?utm_source=x'),
      'https://vimeo.com/12345'
    );
  });

  test('canonicalizes Vimeo dashboard manage/video URLs', () => {
    assert.equal(
      normalizeUrlLike('https://vimeo.com/manage/video/12345?utm_source=x'),
      'https://vimeo.com/12345'
    );
  });
});
