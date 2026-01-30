import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBrief } from '../src/brief.js';

test('MIG-14: generateNextActions detects 400/Bad Request input issues', (t) => {
  const cases = [
    'The server returned a 400 Bad Request error.',
    'It seems like a validation error on the input.',
    'Invalid parameter detected in the request.',
    'Got a 400 when submitting.'
  ];

  for (const transcript of cases) {
    const output = renderBrief({ transcript });
    assert.match(output, /Check API payloads \/ Validation/, `Failed to detect validation issue in: "${transcript}"`);
  }
});
