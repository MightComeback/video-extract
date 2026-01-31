import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: Heuristics - Storage and Database Vendors', async (t) => {
  await t.test('suggests checking S3 when S3 is mentioned directly', () => {
    const actions = generateNextActions('The S3 bucket is not accessible');
    assert.ok(
      actions.some(a => a.includes('Check file upload limits / S3')),
      `Expected S3 mention to trigger check. Got: ${JSON.stringify(actions)}`
    );
  });

  await t.test('suggests checking database when Supabase is mentioned', () => {
    const actions = generateNextActions('Supabase connection timed out');
    assert.ok(
      actions.some(a => a.includes('Check database state')),
      `Expected Supabase to trigger database check. Got: ${JSON.stringify(actions)}`
    );
  });

  await t.test('suggests checking database when DynamoDB is mentioned', () => {
    const actions = generateNextActions('DynamoDB throttling events');
    assert.ok(
      actions.some(a => a.includes('Check database state')),
      `Expected DynamoDB to trigger database check. Got: ${JSON.stringify(actions)}`
    );
  });
});
