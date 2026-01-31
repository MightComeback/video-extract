import { test } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects feature flags extended providers', async (t) => {
  await t.test('detects PostHog related feature flag issues', () => {
    const transcript = 'I think the PostHog flag is disabled for this user.';
    const actions = generateNextActions(transcript);
    assert.deepStrictEqual(actions, [
      '- [ ] Reproduce locally',
      '- [ ] Check feature flags / rollout status'
    ]);
  });

  await t.test('detects GrowthBook related feature flag issues', () => {
    const transcript = 'GrowthBook says this experiment is off.';
    const actions = generateNextActions(transcript);
    assert.deepStrictEqual(actions, [
      '- [ ] Reproduce locally',
      '- [ ] Check feature flags / rollout status'
    ]);
  });
});
