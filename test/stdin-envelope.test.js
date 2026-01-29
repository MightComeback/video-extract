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

test('extractFromStdin accepts bare fathom.video URLs (no scheme) and normalizes to https://', () => {
  const input = [
    'Source: fathom.video/share/abc',
    'Title: Bare URL',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Bare URL');
});

test('extractFromStdin tolerates quoted envelope lines (">", ">>", etc.) for Source and Title', () => {
  const input = [
    '>> Source: https://fathom.video/share/abc',
    '> Title: Login breaks on Safari',
    '>>> 00:01 Alice: it crashes',
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

test('extractFromStdin strips parenthetical labels after Source URLs', () => {
  const input = [
    'Source: https://fathom.video/share/abc (Fathom)',
    'Title: Parenthetical label',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Parenthetical label');
});

test('extractFromStdin accepts curly-quoted Source URLs (smart quotes)', () => {
  const input = [
    'Source: “https://fathom.video/share/abc”',
    'Title: Curly quoted URL',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Curly quoted URL');
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

test('extractFromStdin accepts "Source = <url>" and "Title = ..." style labels (equals separator)', () => {
  const input = [
    'Source = https://fathom.video/share/abc',
    'Title = Login breaks on Safari',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Login breaks on Safari');
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

test('extractFromStdin treats "Topic:" as a Title alias', () => {
  const input = [
    'Source: https://fathom.video/share/abc',
    'Topic: Login breaks on Safari',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Login breaks on Safari');
});

test('extractFromStdin treats "Description:" as a Title alias', () => {
  const input = [
    'Source: https://fathom.video/share/abc',
    'Description: Login breaks on Safari',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Login breaks on Safari');
  assert.match(out.text, /00:01/);
});

test('extractFromStdin treats "Summary:" as a Title alias', () => {
  const input = [
    'Source: https://fathom.video/share/abc',
    'Summary: Login breaks on Safari',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Login breaks on Safari');
  assert.match(out.text, /00:01/);
});

test('extractFromStdin accepts "Title - ..." style labels (dash separator)', () => {
  const input = [
    'Source: https://fathom.video/share/abc',
    'Title - Login breaks on Safari',
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

test('extractFromStdin accepts Slack-style "<url|label>" Sources even without a scheme', () => {
  const input = [
    'Source: <fathom.video/share/abc|Fathom>',
    'Title: Slack link (bare) source',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Slack link (bare) source');
});

test('extractFromStdin accepts "Recording:" as a Source alias', () => {
  const input = [
    'Recording: https://fathom.video/share/abc',
    'Title: Recording label',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Recording label');
});

test('extractFromStdin accepts "Meeting:" as a Source alias', () => {
  const input = [
    'Meeting: https://fathom.video/share/abc',
    'Title: Meeting label',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Meeting label');
});

test('extractFromStdin accepts "Call:" as a Source alias', () => {
  const input = [
    'Call: https://fathom.video/share/abc',
    'Title: Call label',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Call label');
});

test('extractFromStdin accepts "Fathom link:" as a Source alias', () => {
  const input = [
    'Fathom link: https://fathom.video/share/abc',
    'Title: Fathom link label',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Fathom link label');
});

test('extractFromStdin accepts "Share link:" as a Source alias', () => {
  const input = [
    'Share link: https://fathom.video/share/abc',
    'Title: Share link label',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Share link label');
});

test('extractFromStdin accepts "Meet link:" as a Source alias', () => {
  const input = [
    'Meet link: https://fathom.video/share/abc',
    'Title: Meet link label',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Meet link label');
});

test('extractFromStdin accepts "Google Meet link:" as a Source alias', () => {
  const input = [
    'Google Meet link: https://fathom.video/share/abc',
    'Title: Google Meet link label',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Google Meet link label');
});

test('extractFromStdin accepts "Teams link:" as a Source alias', () => {
  const input = [
    'Teams link: https://fathom.video/share/abc',
    'Title: Teams link label',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Teams link label');
});

test('extractFromStdin accepts "Zoom link:" as a Source alias', () => {
  const input = [
    'Zoom link: https://fathom.video/share/abc',
    'Title: Zoom link label',
    '00:01 Alice: it crashes',
  ].join('\n');

  const out = extractFromStdin({ content: input, source: 'stdin' });
  assert.equal(out.source, 'https://fathom.video/share/abc');
  assert.equal(out.title, 'Zoom link label');
});
