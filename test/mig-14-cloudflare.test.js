import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

describe('MIG-14: generateNextActions', () => {
  it('detects Cloudflare issues', () => {
    const transcript = "I got a Cloudflare error page when trying to access the dashboard. It showed a Ray ID.";
    const actions = generateNextActions(transcript);
    assert.ok(
      actions.some((a) => a.includes('Check Cloudflare logs / WAF')),
      `Expected Cloudflare action, got: ${actions.join(', ')}`
    );
  });

  it('detects WAF blocks', () => {
    const transcript = "The WAF blocked my request.";
    const actions = generateNextActions(transcript);
    assert.ok(
      actions.some((a) => a.includes('Check Cloudflare logs / WAF')),
      `Expected Cloudflare/WAF action, got: ${actions.join(', ')}`
    );
  });
});
