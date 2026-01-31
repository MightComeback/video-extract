
import { test } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects Feature Flag issues', () => {
  const cases = [
    'Is the feature flag enabled for this user?',
    'We just turned on the rollout for 50%',
    'This assumes the new experiment is active',
    'I forgot to flip the flag in LaunchDarkly',
    'Feature toggle is off',
  ];

  for (const transcript of cases) {
    const actions = generateNextActions(transcript);
    assert.ok(
      actions.includes('- [ ] Check feature flags / rollout status'),
      `Failed to detect feature flag issue in: "${transcript}"`
    );
  }
});
