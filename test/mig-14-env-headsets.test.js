import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects ChromeOS', () => {
  const brief = renderBrief({
    transcript: 'I am running this on my Chromebook and it fails.',
  });
  assert.match(brief, /ChromeOS/);
});

test('MIG-14: extractEnvironment detects visionOS', () => {
  const brief = renderBrief({
    transcript: 'Tested on Apple Vision Pro and the spatial video is broken.',
  });
  assert.match(brief, /visionOS/);
});

test('MIG-14: extractEnvironment detects Meta Quest', () => {
  const brief = renderBrief({
    transcript: 'Using the browser on Oculus Quest 2.',
  });
  assert.match(brief, /Meta Quest/);
});
