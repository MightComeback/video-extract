import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'bun:test';

describe('Loom fixtures', () => {
    it('loads loom-fake.html fixture', () => {
        const fixturePath = 'test/fixtures/loom-fake.html';
        const html = fs.readFileSync(fixturePath, 'utf8');
        expect(html).toContain('Test Loom Video with Title');
        expect(html).toContain('RegularUserVideo');
    });

    it('loads loom-fake2.html fixture', () => {
        const fixturePath = 'test/fixtures/loom-fake2.html';
        const html = fs.readFileSync(fixturePath, 'utf8');
        expect(html).toContain('Loom Video with Multiple Speakers');
    });

    it('loads loom-silent.html fixture', () => {
        const fixturePath = 'test/fixtures/loom-silent.html';
        const html = fs.readFileSync(fixturePath, 'utf8');
        expect(html).toContain('Silent Loom Video');
        expect(html).toContain('nullableRawCdnUrlM3U8');
    });
});
