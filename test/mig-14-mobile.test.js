import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects iOS from iPhone', () => {
  const result = renderBrief({
    transcript: "I was using my iPhone and it crashed."
  });
  assert.match(result, /Browser \/ OS: iOS/);
});

test('MIG-14: extractEnvironment detects iOS from iPad', () => {
  const result = renderBrief({
    transcript: "I tested this on my iPad Pro."
  });
  assert.match(result, /Browser \/ OS: iOS/);
});

test('MIG-14: extractEnvironment detects Android', () => {
  const result = renderBrief({
    transcript: "On Android the button is missing."
  });
  assert.match(result, /Browser \/ OS: Android/);
});

test('MIG-14: extractEnvironment detects plain iOS', () => {
  const result = renderBrief({
    transcript: "The bug appears on iOS 17."
  });
  assert.match(result, /Browser \/ OS: iOS/);
});
