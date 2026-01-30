import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('extracts git SHA from transcript', () => {
  const brief = renderBrief({
    transcript: 'We deployed commit 8f3d2a1 yesterday.'
  });
  // Should find the SHA
  assert.match(brief, /Build \/ SHA: 8f3d2a1/);
});

test('extracts git SHA with colon prefix', () => {
  const brief = renderBrief({
    transcript: 'Current SHA: a1b2c3d4e5f6'
  });
  assert.match(brief, /Build \/ SHA: a1b2c3d4e5f6/);
});

test('extracts complex semver with suffix', () => {
  const brief = renderBrief({
    transcript: 'Running version 2.0.0-rc.1 locally'
  });
  assert.match(brief, /Build \/ SHA: 2.0.0-rc.1/);
});
