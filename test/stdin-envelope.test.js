import test from 'node:test';
import assert from 'node:assert/strict';

import { extractFromStdin } from '../src/extractor.js';

test('extractFromStdin supports markdown headings like "## Title"', () => {
  const input = [
    'Source: https://fathom.video/share/abc',
    '## Login breaks on Safari',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Login breaks on Safari');
  assert.match(out.text, /00:01/);
});

test('extractFromStdin accepts angle-bracket wrapped Source URLs', () => {
  const input = [
    'Source: <https://fathom.video/share/abc>',
    '# Some title',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Some title');
});

test('extractFromStdin accepts common chat wrappers around Source URLs', () => {
  const input = [
    'Source: `https://fathom.video/share/abc`',
    'Title: Wrapped URL',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Wrapped URL');
});

test('extractFromStdin accepts "Source - <url>" style labels (dash separator)', () => {
  const input = [
    'Source - https://fathom.video/share/abc',
    'Title: Dash label',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Dash label');
});

test('extractFromStdin treats "Subject:" as a Title alias', () => {
  const input = [
    'Source: https://fathom.video/share/abc',
    'Subject: Login breaks on Safari',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Login breaks on Safari');
});

test('extractFromStdin accepts markdown link Sources like "[label](url)"', () => {
  const input = [
    'Source: [Fathom link](https://fathom.video/share/abc)',
    'Title: Markdown link source',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Markdown link source');
});

test('extractFromStdin accepts Slack-style "<url|label>" Sources', () => {
  const input = [
    'Source: <https://fathom.video/share/abc|Fathom>',
    'Title: Slack link source',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Slack link source');
});
