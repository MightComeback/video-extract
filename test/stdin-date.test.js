import { test } from 'node:test';
import assert from 'node:assert';
import { extractFromStdin } from '../src/extractor.js';
import { renderBrief } from '../src/brief.js';

test('extractFromStdin: parses Date field', () => {
  const input = `
Source: https://fathom.video/share/123
Date: 2025-01-30
Title: My Meeting

00:01 Alice: Hello
  `.trim();

  const result = extractFromStdin({ content: input });
  assert.strictEqual(result.source, 'https://fathom.video/share/123');
  assert.strictEqual(result.title, 'My Meeting');
  assert.strictEqual(result.date, '2025-01-30');
  assert.match(result.text, /^00:01 Alice: Hello/);
});

test('extractFromStdin: mixed order', () => {
  const input = `
Date: 2025-01-30
Title: My Meeting
https://fathom.video/share/123

00:01 Alice: Hello
  `.trim();

  const result = extractFromStdin({ content: input });
  assert.strictEqual(result.source, 'https://fathom.video/share/123');
  assert.strictEqual(result.title, 'My Meeting');
  assert.strictEqual(result.date, '2025-01-30');
});

test('renderBrief: includes Date in output', () => {
  const brief = renderBrief({
    source: 'https://example.com',
    title: 'Test',
    date: '2025-01-30',
    transcript: '00:01 Hello'
  });

  assert.match(brief, /^- When: 2025-01-30/m);
});
