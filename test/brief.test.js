import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderBrief, generateNextActions } from '../src/brief.js';

// Restored tests
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

// New tests
test('brief extracts Expected/Actual from transcript', (t) => {
  const transcript = `
Ivan: I was testing the login page.
Ivan: The goal was to see the dashboard.
Ivan: But instead, I got an error 500.
Ivan: It crashed completely.
`;

  const out = renderBrief({ transcript, teaserMax: 0, timestampsMax: 0 });

  // Check Expected
  assert.match(out, /Expected:.*The goal was to see the dashboard/);

  // Check Actual
  assert.match(out, /Actual:.*got an error 500/);
});

test('brief generates Next Actions based on keywords (server error / latency)', (t) => {
  const transcript = `
System: 502 Bad Gateway
User: It is so slow, latency is high.
`;

  const out = renderBrief({ transcript, teaserMax: 0, timestampsMax: 0 });

  // "502 Bad Gateway" -> Check server logs
  assert.match(out, /Check server logs/);

  // "slow", "latency" -> Check network traces
  assert.match(out, /Check network traces/);
});

test('brief extracts environment from transcript', (t) => {
  const transcript = `
I am using Chrome on macOS.
`;
  const out = renderBrief({ transcript, teaserMax: 0, timestampsMax: 0 });
  
  assert.match(out, /Browser \/ OS:.*Chrome/);
  assert.match(out, /Browser \/ OS:.*macOS/);
});
