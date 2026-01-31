import { test } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('generateNextActions detects flaky/intermittent issues', () => {
  const transcript = "It only happens sometimes when I reload quickly. Like, it's very intermittent.";
  const actions = generateNextActions(transcript);
  
  // exact string match dependent on implementation
  const expected = '- [ ] Investigate race conditions / flaky behavior';
  
  assert.ok(actions.includes(expected), `Expected actions to include "${expected}", got: ${actions.join('\n')}`);
});
