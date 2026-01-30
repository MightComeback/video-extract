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
