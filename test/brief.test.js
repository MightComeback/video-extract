import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const briefBinPath = path.resolve(__dirname, '..', 'bin', 'fathom2action-brief.js');

function runBrief(args, { stdin, timeoutMs = 20_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [briefBinPath, ...args], { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });

    if (stdin != null) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}

test('brief supports --stdin and prints deterministic sections', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['00:01 Alice: It crashes', '00:05 Bob: Yep', ''].join('\n'),
  });

  assert.match(stdout, /^# Bug report brief/m);
  assert.match(stdout, /^## 1-sentence summary/m);
  assert.match(stdout, /^## Repro steps/m);
  assert.match(stdout, /^## Expected vs actual/m);
  assert.match(stdout, /^## Timestamps/m);
  assert.match(stdout, /^- 00:01 — /m);
  assert.match(stdout, /^- 00:05 — /m);
  assert.match(stdout, /^## Next actions/m);
  assert.match(stdout, /^## Transcript teaser \(first lines\)/m);
  assert.match(stdout, /^- 00:01 Alice: It crashes/m);
});
