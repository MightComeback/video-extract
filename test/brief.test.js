import { test } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('generateNextActions detects feature flags', () => {
  const transcript = "We suspect this is related to the new feature flag rollout.";
  const actions = generateNextActions(transcript);
  assert.ok(actions.includes('- [ ] Check feature flags / rollout status'), 'Should recommend checking feature flags');
});

test('generateNextActions detects A/B tests', () => {
  const transcript = "Is this happening in the A/B test group?";
  const actions = generateNextActions(transcript);
  assert.ok(actions.includes('- [ ] Check feature flags / rollout status'), 'Should recommend checking feature flags for A/B test');
});

test('generateNextActions detects canary deployments', () => {
    const transcript = "The canary release seems unstable.";
    const actions = generateNextActions(transcript);
    assert.ok(actions.includes('- [ ] Check feature flags / rollout status'), 'Should recommend checking feature flags for canary');
  });
