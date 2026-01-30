import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects 503 Service Unavailable explicitly', (t) => {
  const actions = generateNextActions('The server returned a 503 error', []);
  assert.ok(actions.includes('- [ ] Check server logs / Sentry'));
});

test('MIG-14: generateNextActions detects 502 Bad Gateway explicitly', (t) => {
  const actions = generateNextActions('We got a 502 from the load balancer', []);
  assert.ok(actions.includes('- [ ] Check server logs / Sentry'));
});

test('MIG-14: generateNextActions detects 504 Gateway Time-out explicitly', (t) => {
  const actions = generateNextActions('The request timed out with 504', []);
  assert.ok(actions.includes('- [ ] Check server logs / Sentry'));
});
