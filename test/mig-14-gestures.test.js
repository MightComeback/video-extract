import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

describe('MIG-14: generateNextActions detects Touch / Gesture issues', () => {
  it('detects Swipe gestures', () => {
    const transcript = "I tried to swipe left but nothing happened.";
    const actions = generateNextActions(transcript);
    assert.match(actions.join('\n'), /Check touch events \/ gestures/);
  });

  it('detects Tap interactions', () => {
    const transcript = "When I tap the button on my phone it doesn't respond.";
    const actions = generateNextActions(transcript);
    assert.match(actions.join('\n'), /Check touch events \/ gestures/);
  });

  it('detects Pinch/Zoom', () => {
    const transcript = "I can't pinch to zoom on the map.";
    const actions = generateNextActions(transcript);
    assert.match(actions.join('\n'), /Check touch events \/ gestures/);
  });
});
