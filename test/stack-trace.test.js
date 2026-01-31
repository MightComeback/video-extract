import { test } from 'node:test';
import assert from 'node:assert';
import { extractStackTraces } from '../src/brief.js';

test('extracts JS stack traces', () => {
  const input = `
Something went wrong:
TypeError: Cannot read property 'foo' of undefined
    at bar (file.js:10:2)
    at baz (file.js:15:4)
  `;
  const traces = extractStackTraces(input);
  assert.strictEqual(traces.length, 1);
  assert.match(traces[0], /^TypeError:/);
});

test('extracts Python stack traces', () => {
  const input = `
Something happened.
Traceback (most recent call last):
  File "main.py", line 10, in <module>
    foo()
ValueError: bad value
  `;
  const traces = extractStackTraces(input);
  assert.strictEqual(traces.length, 1, 'Should find 1 trace');
  assert.match(traces[0], /^Traceback/);
});
