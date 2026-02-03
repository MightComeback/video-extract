import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects feature flags (extended) - PostHog', () => {
  const actions = generateNextActions('PostHog feature flag rollout is broken');
  assert.ok(actions.some((a) => a.includes('Check feature flags / rollout status')));
});

test('MIG-14: generateNextActions detects feature flags (extended) - Statsig', () => {
  const actions = generateNextActions('Statsig experiment is causing issues');
  assert.ok(actions.some((a) => a.includes('Check feature flags / rollout status')));
});

test('MIG-14: generateNextActions detects feature flags (extended) - LaunchDarkly', () => {
  const actions = generateNextActions('LaunchDarkly flag toggled unexpectedly');
  assert.ok(actions.some((a) => a.includes('Check feature flags / rollout status')));
});
