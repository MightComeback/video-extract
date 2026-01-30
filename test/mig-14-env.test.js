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

test('MIG-14: extractEnvironment detects Ubuntu', (t) => {
  const transcript = "I am running this on Ubuntu Linux.";
  const output = renderBrief({ transcript });
  assert.match(output, /Browser \/ OS: .*Ubuntu/);
});

test('MIG-14: extractEnvironment detects Samsung Internet', (t) => {
  const transcript = "I saw this on Samsung Internet browser.";
  const output = renderBrief({ transcript });
  assert.ok(output.includes('Browser / OS: Samsung Internet'));
});
