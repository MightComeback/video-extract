import { test } from 'node:test';
import assert from 'node:assert';
import { formatCsv } from '../src/extractor.js';

test('formatCsv: formats expected fields correctly', (t) => {
  const data = {
    date: '2025-01-30',
    title: 'My Call',
    source: 'https://example.com',
    mediaUrl: 'https://cdn.example.com/video.mp4',
    description: 'A test call',
    text: 'Alice: Hello.\nBob: Hi.'
  };

  const csv = formatCsv(data);
  // date, title, source, mediaUrl, description, screenshot, text
  const expected = '2025-01-30,My Call,https://example.com,https://cdn.example.com/video.mp4,A test call,,"Alice: Hello.\nBob: Hi."';
  assert.strictEqual(csv.trim(), expected);
});

test('formatCsv: handles special characters', (t) => {
  const data = {
    title: 'Title with "quotes" and, commas',
    description: '',
    text: ''
  };
  const csv = formatCsv(data);
  const parts = csv.split(',');
  // date(0), title(1)
  // "Title with ""quotes"" and, commas"
  // But wait, split(',') is naive if quotes contain commas.
  // Let's just match the string.
  assert.ok(csv.includes('"Title with ""quotes"" and, commas"'));
});
