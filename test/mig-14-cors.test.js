
import { test } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects CORS errors', () => {
  const result = generateNextActions('The browser blocked the request due to CORS policy.');
  assert.ok(result.some(a => a.includes('Check CORS configuration') || a.includes('Access-Control-Allow-Origin')), 'Should suggest checking CORS');
});

test('MIG-14: generateNextActions detects 429 Too Many Requests', () => {
  const result = generateNextActions('It failed with a 429 status code.');
  assert.ok(result.some(a => a.includes('Check rate limits') || a.includes('Check API quotas')), 'Should suggest checking rate limits');
});
