import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

describe('MIG-14: Clipboard heuristics', () => {
  it('detects clipboard failure', () => {
    const transcript = `
      I tried to copy the text but nothing happened.
      The clipboard seems empty.
      Can't paste into the field.
      Copy paste is broken.
    `;
    const actions = generateNextActions(transcript);
    assert.ok(
      actions.some(a => a.includes('Check clipboard API / permissions')),
      'Should suggest checking clipboard'
    );
  });

  it('detects specific paste errors', () => {
    const transcript = `
      Error: Read permission denied.
      DOMException: Document is not focused.
      Navigator.clipboard.readText failed.
    `;
    const actions = generateNextActions(transcript);
    assert.ok(
      actions.some(a => a.includes('Check clipboard API / permissions')),
      'Should suggest checking clipboard for DOM exceptions'
    );
  });
});
