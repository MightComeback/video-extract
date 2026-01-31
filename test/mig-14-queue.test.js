import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects Background Job / Queue issues', () => {
  const actions = generateNextActions('The video processing job is stuck in the queue for hours.');
  assert(actions.includes('- [ ] Check background job processing / queues'));
});

test('MIG-14: generateNextActions detects specific queue tech (Sidekiq/BullMQ)', () => {
  const actions = generateNextActions('Sidekiq workers are not picking up new tasks.');
  assert(actions.includes('- [ ] Check background job processing / queues'));
});

test('MIG-14: generateNextActions detects Kafka lag', () => {
  const actions = generateNextActions('Kafka consumer lag is increasing.');
  assert(actions.includes('- [ ] Check background job processing / queues'));
});
