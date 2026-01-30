
import { test } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects Redis / Connection issues', () => {
  const cases = [
    'Connection to Redis refused',
    'Error: econnrefused at 127.0.0.1:6379',
    'socket hang up while connecting to backend',
    'Connection refused by upstream',
  ];

  for (const transcript of cases) {
    const actions = generateNextActions(transcript);
    assert.ok(
      actions.includes('- [ ] Check Redis / backend connectivity'),
      `Failed to detect connection issue in: "${transcript}"`
    );
  }
});

test('MIG-14: generateNextActions detects File Upload / Size issues', () => {
  const cases = [
    'File too large error when uploading',
    'Payload too large',
    'Entity too large',
    'Attachment upload failed',
  ];

  for (const transcript of cases) {
    const actions = generateNextActions(transcript);
    assert.ok(
      actions.includes('- [ ] Check file upload limits / S3'),
      `Failed to detect upload issue in: "${transcript}"`
    );
  }
});
