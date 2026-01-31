import { test } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('generateNextActions detects Figma/Design keywords', () => {
  const transcript = "It looks different from the Figma mockup. The spacing is off.";
  const actions = generateNextActions(transcript, []);
  
  const hasDesignCheck = actions.some(a => a.includes('Check Figma / Design specs'));
  assert.strictEqual(hasDesignCheck, true, 'Should recommend checking Figma');
});

test('generateNextActions detects design mismatch keywords', () => {
  const transcript = "It doesn't match the design specs.";
  const actions = generateNextActions(transcript, []);
  
  const hasDesignCheck = actions.some(a => a.includes('Check Figma / Design specs'));
  assert.strictEqual(hasDesignCheck, true, 'Should recommend checking Figma');
});
