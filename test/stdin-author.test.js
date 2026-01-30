import { test } from 'node:test';
import assert from 'node:assert';
import { extractFromStdin } from '../src/extractor.js';

test('extractFromStdin: parses Author field', () => {
  const input = `
Source: https://fathom.video/share/123
Author: Ivan K
Title: My Meeting

00:01 Alice: Hello
  `.trim();

  const result = extractFromStdin({ content: input });
  assert.strictEqual(result.source, 'https://fathom.video/share/123');
  assert.strictEqual(result.title, 'My Meeting');
  assert.strictEqual(result.author, 'Ivan K');
});

test('extractFromStdin: parses Who field', () => {
  const input = `
Source: https://fathom.video/share/123
Who: Jane Doe
Title: My Meeting

00:01 Alice: Hello
  `.trim();

  const result = extractFromStdin({ content: input });
  assert.strictEqual(result.author, 'Jane Doe');
});

test('extractFromStdin: parses By field', () => {
  const input = `
Source: https://fathom.video/share/123
By: DevOps Team
Title: My Meeting

00:01 Alice: Hello
  `.trim();

  const result = extractFromStdin({ content: input });
  assert.strictEqual(result.author, 'DevOps Team');
});
