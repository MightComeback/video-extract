import { test } from 'node:test';
import assert from 'node:assert';
import { formatSheetRow, indexToColumn } from '../src/sheets.js';

test('formatSheetRow: returns correct array order', (t) => {
  const data = {
    date: '2025-01-31',
    title: 'Test Call',
    source: 'https://example.com',
    mediaUrl: 'https://cdn.example.com/video.mp4',
    description: 'Desc',
    screenshot: 'img.png',
    text: 'Hello world'
  };
  
  const row = formatSheetRow(data);
  assert.deepStrictEqual(row, [
    '2025-01-31',
    'Test Call',
    'https://example.com',
    'https://cdn.example.com/video.mp4',
    'Desc',
    'img.png',
    'Hello world'
  ]);
});

test('formatSheetRow: handles missing fields', (t) => {
  const row = formatSheetRow({ title: 'Just Title' });
  assert.deepStrictEqual(row, ['', 'Just Title', '', '', '', '', '']);
});

test('indexToColumn: converts 0-based index to A1 notation', (t) => {
  assert.strictEqual(indexToColumn(0), 'A');
  assert.strictEqual(indexToColumn(1), 'B');
  assert.strictEqual(indexToColumn(25), 'Z');
  assert.strictEqual(indexToColumn(26), 'AA');
  assert.strictEqual(indexToColumn(27), 'AB');
});
