import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects macOS Mojave', (t) => {
  const transcript = "Is this reproducing on Mojave?";
  const output = renderBrief({ transcript });
  assert.match(output, /Browser \/ OS: .*Mojave/);
});

test('MIG-14: extractEnvironment detects macOS High Sierra', (t) => {
  const transcript = "Confirmed bug on High Sierra 10.13.";
  const output = renderBrief({ transcript });
  assert.match(output, /Browser \/ OS: .*High Sierra/);
});

test('MIG-14: extractEnvironment detects macOS Sierra', (t) => {
  const transcript = "Sierra user reported weird behavior.";
  const output = renderBrief({ transcript });
  assert.match(output, /Browser \/ OS: .*Sierra/);
});

test('MIG-14: extractEnvironment detects macOS El Capitan', (t) => {
  const transcript = "Old machine running El Capitan.";
  const output = renderBrief({ transcript });
  assert.match(output, /Browser \/ OS: .*El Capitan/);
});

test('MIG-14: extractEnvironment detects macOS Yosemite', (t) => {
  const transcript = "Yosemite is really old now.";
  const output = renderBrief({ transcript });
  assert.match(output, /Browser \/ OS: .*Yosemite/);
});

test('MIG-14: extractEnvironment detects macOS Mavericks', (t) => {
  const transcript = "Might support Mavericks still?";
  const output = renderBrief({ transcript });
  assert.match(output, /Browser \/ OS: .*Mavericks/);
});
