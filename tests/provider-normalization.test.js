import { describe, expect, test } from 'bun:test';

import { normalizeUrlLike } from '../src/brief.js';
import { extractYoutubeId, normalizeYoutubeUrl, isYoutubeClipUrl, youtubeNonVideoReason } from '../src/providers/youtube.js';
import { extractVimeoId, normalizeVimeoUrl, vimeoNonVideoReason } from '../src/providers/vimeo.js';
import { extractLoomId, normalizeLoomUrl, loomNonVideoReason } from '../src/providers/loom.js';

describe('provider url detection + normalization', () => {
  test('normalizeUrlLike strips common wrappers and html-escaped ampersands', () => {
    const u = normalizeUrlLike('Source: <https://youtube.com/watch?v=dQw4w9WgXcQ&amp;t=43s&utm_source=chat>');
    expect(u).toBe('https://youtube.com/watch?v=dQw4w9WgXcQ&t=43s');
  });

  test('YouTube: extractYoutubeId supports attribution_link', () => {
    const u = 'https://www.youtube.com/attribution_link?u=%2Fwatch%3Fv%3DdQw4w9WgXcQ%26t%3D43s%26feature%3Dshare';
    expect(extractYoutubeId(u)).toBe('dQw4w9WgXcQ');
  });

  test('YouTube: normalizeYoutubeUrl canonicalizes youtu.be and preserves hash time', () => {
    const u = normalizeYoutubeUrl('https://youtu.be/dQw4w9WgXcQ#t=1m2s');
    expect(u).toBe('https://youtube.com/watch?v=dQw4w9WgXcQ&t=1m2s');
  });

  test('YouTube: clip urls are detected as clips (not watch ids)', () => {
    expect(isYoutubeClipUrl('https://www.youtube.com/clip/Ugkx12345ABCDE?t=34')).toBe(true);
  });

  test('YouTube: helpful non-video error for playlists', () => {
    const reason = youtubeNonVideoReason('https://www.youtube.com/playlist?list=PL123');
    expect(reason).toContain('playlist');
  });

  test('Vimeo: extractVimeoId supports player urls', () => {
    expect(extractVimeoId('https://player.vimeo.com/video/123456789')).toBe('123456789');
  });

  test('Vimeo: url detection tolerates smart quotes + trailing punctuation', () => {
    expect(extractVimeoId('“https://vimeo.com/123456789?foo=bar”,')).toBe('123456789');
  });

  test('Vimeo: normalizeVimeoUrl preserves review token path', () => {
    const u = normalizeVimeoUrl('https://player.vimeo.com/video/123456789/review/abcdef/1a2b3c4d');
    expect(u).toBe('https://vimeo.com/123456789/review/abcdef/1a2b3c4d?h=1a2b3c4d');
  });

  test('Vimeo: non-video guidance for on-demand pages', () => {
    const reason = vimeoNonVideoReason('https://vimeo.com/ondemand/somefilm');
    expect(reason).toContain('on-demand');
  });

  test('Loom: extractLoomId supports bare /<id> urls', () => {
    expect(extractLoomId('https://loom.com/abcdef12345')).toBe('abcdef12345');
  });

  test('Loom: url detection tolerates angle wrappers + trailing punctuation', () => {
    expect(extractLoomId('(<https://loom.com/share/abcdef12345?sid=s1>).')).toBe('abcdef12345');
  });

  test('Loom: normalizeLoomUrl keeps sid + deep-link time', () => {
    const u = normalizeLoomUrl('https://www.loom.com/share/abcdef12345?sid=s1&t=30');
    expect(u).toBe('https://loom.com/share/abcdef12345?sid=s1&t=30');
  });

  test('Loom: non-video guidance for login/pricing pages', () => {
    const reason = loomNonVideoReason('https://loom.com/pricing');
    expect(reason).toContain('direct video link');
  });
});
