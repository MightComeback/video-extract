import {  describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

describe('MIG-14: Heuristics - Analytics', () => {
  it('suggests checking analytics when Segment/Mixpanel is mentioned locally', () => {
    const transcript = "The Segment event isn't firing when I click the button.";
    const actions = generateNextActions(transcript);
    assert.ok(actions.includes('- [ ] Check analytics / telemetry logs'), 'should suggest checking analytics');
  });

  it('suggests checking analytics when GA4 is mentioned', () => {
    const transcript = "GA4 isn't tracking the purchase.";
    const actions = generateNextActions(transcript);
    assert.ok(actions.includes('- [ ] Check analytics / telemetry logs'));
  });

  it('detects generic tracking issues', () => {
    const transcript = "The tracking event is missing properties.";
    const actions = generateNextActions(transcript);
    assert.ok(actions.includes('- [ ] Check analytics / telemetry logs'));
  });
});
