import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

describe('MIG-14: Heuristics - Third-party Integrations', () => {
  it('suggests checking integrations when Slack is mentioned locally', () => {
    const transcript = 'The notification did not show up in Slack.';
    const actions = generateNextActions(transcript, []);
    assert.strictEqual(actions.some(a => a.includes('Check third-party integrations (Slack/Salesforce/etc)')), true);
  });

  it('suggests checking integrations when Salesforce is mentioned', () => {
    const transcript = 'The lead was not synced to Salesforce.';
    const actions = generateNextActions(transcript, []);
    assert.strictEqual(actions.some(a => a.includes('Check third-party integrations (Slack/Salesforce/etc)')), true);
  });

  it('suggests checking integrations when HubSpot is mentioned', () => {
    const transcript = 'HubSpot contacts are missing.';
    const actions = generateNextActions(transcript, []);
    assert.strictEqual(actions.some(a => a.includes('Check third-party integrations (Slack/Salesforce/etc)')), true);
  });

  it('suggests checking integrations when Zapier is mentioned', () => {
    const transcript = 'I think the Zapier zap failed.';
    const actions = generateNextActions(transcript, []);
    assert.strictEqual(actions.some(a => a.includes('Check third-party integrations (Slack/Salesforce/etc)')), true);
  });

  it('suggests checking integrations when Zoom/Calendar is mentioned', () => {
    const transcript = 'The Zoom link was not generated in Google Calendar.';
    const actions = generateNextActions(transcript, []);
    assert.strictEqual(actions.some(a => a.includes('Check third-party integrations (Slack/Salesforce/etc)')), true);
  });
});
