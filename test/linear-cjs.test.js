import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('scripts/linear.cjs can be required (cron-friendly)', () => {
  const m = require('../scripts/linear.cjs');
  assert.equal(typeof m.getIssue, 'function');
  assert.equal(typeof m.getIssueStateType, 'function');
  assert.equal(typeof m.addComment, 'function');
});
