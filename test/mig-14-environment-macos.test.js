import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects macOS Sequoia', (t) => {
  const transcript = "We saw this issue on macOS Sequoia after the update.";
  const output = renderBrief({ transcript });
  assert.ok(output.includes('Browser / OS: macOS Sequoia'), `Expected "macOS Sequoia" in env field, got: ${output}`);
});

test('MIG-14: extractEnvironment detects macOS Sonoma', (t) => {
  const transcript = "Tested on Sonoma and it failed.";
  const output = renderBrief({ transcript });
  assert.match(output, /Browser \/ OS: .*Sonoma/);
});

test('MIG-14: extractEnvironment detects macOS Ventura', (t) => {
  const transcript = "Ventura seems to have a regression.";
  const output = renderBrief({ transcript });
  assert.match(output, /Browser \/ OS: .*Ventura/);
});

test('MIG-14: extractEnvironment detects macOS Monterey', (t) => {
  const transcript = "Still supporting Monterey?";
  const output = renderBrief({ transcript });
  assert.match(output, /Browser \/ OS: .*Monterey/);
});
