
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateNextActions, extractBugHints } from '../src/brief.js';

describe('MIG-14: Heuristics - Payment/Billing', () => {
  it('suggests checking Stripe/Billing when payment keywords are present in hints', () => {
    const hints = ['payment declined', 'card rejected'];
    const actions = generateNextActions('', hints);
    assert.strictEqual(actions.some(a => a.includes('Check Stripe logs / Billing status')), true);
  });

  it('suggests checking Stripe/Billing when payment keywords are present in transcript', () => {
    const transcript = 'The user tried to upgrade but their credit card failed.';
    const actions = generateNextActions(transcript, []);
    assert.strictEqual(actions.some(a => a.includes('Check Stripe logs / Billing status')), true);
  });

  it('detects "invoice" and "subscription" keywords', () => {
    const transcript = 'I cannot see my invoice for the last subscription renewal.';
    const actions = generateNextActions(transcript, []);
    assert.strictEqual(actions.some(a => a.includes('Check Stripe logs / Billing status')), true);
  });
});
