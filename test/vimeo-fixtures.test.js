import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'bun:test';

describe('Vimeo fixtures', () => {
    it('loads vimeo-player.html fixture', () => {
        const fixturePath = 'test/fixtures/vimeo-player.html';
        const html = fs.readFileSync(fixturePath, 'utf8');
        expect(html).toContain('player.vimeo.com/video/987654321');
    });

    it('loads vimeo-plus.html fixture', () => {
        const fixturePath = 'test/fixtures/vimeo-plus.html';
        const html = fs.readFileSync(fixturePath, 'utf8');
        expect(html).toContain('player.vimeo.com/video/456789012');
    });

    it('loads vimeo-unlisted.html fixture', () => {
        const fixturePath = 'test/fixtures/vimeo-unlisted.html';
        const html = fs.readFileSync(fixturePath, 'utf8');
        expect(html).toContain('player.vimeo.com/video/789012345');
        expect(html).toContain('h=abc123def456');
    });

    it('loads vimeo-review.html fixture', () => {
        const fixturePath = 'test/fixtures/vimeo-review.html';
        const html = fs.readFileSync(fixturePath, 'utf8');
        expect(html).toContain('player.vimeo.com/video/111222333');
        expect(html).toContain('review_token=xyz789');
    });
});
