import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'bun:test';

describe('YouTube fixtures', () => {
    it('loads youtube-watch.html fixture', () => {
        const fixturePath = 'test/fixtures/youtube-watch.html';
        const html = fs.readFileSync(fixturePath, 'utf8');
        expect(html).toContain('jNQXAC9IVRw');
        expect(html).toContain('Me at the zoo');
        expect(html).toContain('ytInitialPlayerResponse');
    });

    it('loads youtube-disabled-comments.html fixture', () => {
        const fixturePath = 'test/fixtures/youtube-disabled-comments.html';
        const html = fs.readFileSync(fixturePath, 'utf8');
        expect(html).toContain('jNQXAC9IVRw');
        expect(html).toContain('Test YouTube Video');
        expect(html).toContain('isCommentEnabled');
    });

    it('loads youtube-short.html fixture', () => {
        const fixturePath = 'test/fixtures/youtube-short.html';
        const html = fs.readFileSync(fixturePath, 'utf8');
        expect(html).toContain('jNQXAC9IVRw');
        expect(html).toContain('Test YouTube Short');
        expect(html).toContain('isShorts');
    });

    it('loads youtube-live.html fixture', () => {
        const fixturePath = 'test/fixtures/youtube-live.html';
        const html = fs.readFileSync(fixturePath, 'utf8');
        expect(html).toContain('jNQXAC9IVRw');
        expect(html).toContain('Test YouTube Live Stream');
        expect(html).toContain('isLiveContent');
    });

    it('loads youtube-no-captions.html fixture', () => {
        const fixturePath = 'test/fixtures/youtube-no-captions.html';
        const html = fs.readFileSync(fixturePath, 'utf8');
        expect(html).toContain('jNQXAC9IVRw');
        expect(html).toContain('Test YouTube Video No Captions');
        expect(html).toContain('captionTracks');
    });
});
