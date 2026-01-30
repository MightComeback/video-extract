import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects Vivaldi', (t) => {
  const transcript = "I was testing on Vivaldi and it looked weird.";
  const output = renderBrief({ transcript });
  assert.ok(output.includes('Browser / OS: Vivaldi'));
});

test('MIG-14: extractEnvironment detects Chromium', (t) => {
  const transcript = "Is this reproducible on Chromium?";
  const output = renderBrief({ transcript });
  assert.ok(output.includes('Browser / OS: Chromium'));
});

test('MIG-14: extractEnvironment detects DuckDuckGo', (t) => {
  const transcript = "I'm using DuckDuckGo browser on my phone.";
  const output = renderBrief({ transcript });
  assert.ok(output.includes('Browser / OS: DuckDuckGo'));
});
