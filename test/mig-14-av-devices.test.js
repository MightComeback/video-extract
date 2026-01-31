
import { test } from 'node:test';
import assert from 'node:assert';
import { generateNextActions, extractBugHints } from '../src/brief.js';

test('MIG-14: generateNextActions detects Audio/Video device issues', () => {
  const transcript = `
    I tried to join the call but my camera wasn't working.
    The browser asked for microphone permission and I clicked allow, but still no audio.
    I can't hear anyone.
    Webcam failed to start.
  `;
  
  const hints = extractBugHints(transcript);
  const actions = generateNextActions(transcript, hints.actual);

  const found = actions.some(a => 
    a.toLowerCase().includes('audio') || 
    a.toLowerCase().includes('video') || 
    a.toLowerCase().includes('microphone') || 
    a.toLowerCase().includes('camera')
  );

  // We expect failure initially as we haven't implemented it yet.
  // Actually, we want to assert that it DOES detect it once implemented.
  // For now, let's just log what we found.
  // The test should fail if "Check Audio/Video permissions" is not in actions.
  
  const expectedAction = 'Check Audio/Video permissions & device selection';
  const hasIt = actions.some(a => a.includes(expectedAction));

  assert.ok(hasIt, `Expected action "${expectedAction}" not found in: ${JSON.stringify(actions)}`);
});
