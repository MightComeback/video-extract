import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: renderBrief handles undefined inputs gracefully', (t) => {
  const output = renderBrief();
  assert.ok(output.includes('# Bug report brief'));
  assert.ok(output.includes('Source: (unknown)'));
});

test('MIG-14: renderBrief handles empty objects', (t) => {
  const output = renderBrief({});
  assert.ok(output.includes('# Bug report brief'));
});

test('MIG-14: renderBrief handles missing transcript', (t) => {
  const output = renderBrief({ title: 'Test' });
  assert.ok(output.includes('Title: Test'));
  assert.ok(output.includes('Expected: ')); // Should be empty, not undefined
});

test('MIG-14: renderBrief includes fetch error when provided', (t) => {
  const output = renderBrief({ fetchError: 'Network timeout' });
  assert.ok(output.includes('Fetch error: Network timeout'));
  assert.ok(output.includes('Source: (unknown)'));
});

test('MIG-14: renderBrief includes fetch error but preserves title if known', (t) => {
  const output = renderBrief({ title: 'Known Title', fetchError: 'Some error' });
  assert.ok(output.includes('Title: Known Title'));
  assert.ok(output.includes('Fetch error: Some error'));
});

test('MIG-14: renderBrief accepts url as an alias for source', (t) => {
  const output = renderBrief({ url: 'https://example.com' });
  assert.ok(output.includes('Source: https://example.com'));
});


test('MIG-14: renderBrief extracts version/build numbers', (t) => {
  const output = renderBrief({ transcript: 'Found in v1.2.3 on staging' });
  assert.ok(output.includes('Build / SHA: 1.2.3'));
});
