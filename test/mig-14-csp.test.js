import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

describe('MIG-14: CSP Heuristics', () => {
  it('detects CSP errors', () => {
    const transcript = `
      The console says refused to load script because of Content Security Policy.
      It's blocked by client.
      CSP error on connect-src.
    `;
    const actions = generateNextActions(transcript);
    assert.ok(
      actions.some(a => a.includes('Check Content Security Policy')),
      'Should suggest checking CSP'
    );
  });

  it('detects specific directive mentions', () => {
    const transcript = `
      Violates the policy script-src 'self'.
      Refused to connect to api.segment.io because it violates the following Content Security Policy directive: "connect-src 'self'".
    `;
    const actions = generateNextActions(transcript);
    assert.ok(
      actions.some(a => a.includes('Check Content Security Policy')),
      'Should suggest checking CSP for directive violations'
    );
  });
});
