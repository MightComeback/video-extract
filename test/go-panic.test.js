import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractStackTraces } from '../src/brief.js';

test('extractStackTraces detects Go panics', () => {
  const transcript = `
The server crashed hard.
panic: runtime error: invalid memory address or nil pointer dereference
[signal SIGSEGV: segmentation violation code=0x1 addr=0x0 pc=0x10a2e30]

goroutine 1 [running]:
main.main()
\t/Users/might/go/src/app/main.go:10 +0x39
  `;

  const traces = extractStackTraces(transcript);
  if (traces.length === 0) {
      // Fail explicitly if empty to allow test runner to show it properly
      assert.fail(`Expected traces but got empty array. Transcript:\n${transcript}`);
  }
  assert.match(traces[0], /^panic: runtime error/, 'Should start with panic message');
  assert.match(traces[0], /goroutine \d+ \[running\]:/, 'Should include goroutine info');
});
