import { downloadMedia } from '../src/utils.js';
import assert from 'assert';
import { test } from 'node:test';

test('downloadMedia is exported and is a function', () => {
    assert.strictEqual(typeof downloadMedia, 'function');
});
