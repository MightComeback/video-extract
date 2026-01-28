import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const briefBinPath = path.resolve(__dirname, '..', 'bin', 'fathom2action-brief.js');

function runBrief(args, { timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [briefBinPath, ...args], { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout, stderr });
    });
  });
}

test('brief CLI does not crash when URL fetch fails; prints NOTE to stderr', async () => {
  const { stdout, stderr } = await runBrief(['http://localhost:1/share/abc']);
  assert.ok(stdout.length > 0);
  assert.match(stderr, /NOTE: Unable to fetch this link/i);
  assert.match(stderr, /fathom2action-brief\.js --stdin|fathom2action --stdin/);
});

test('brief CLI prints version with --version', async () => {
  const { stdout, stderr } = await runBrief(['--version']);
  assert.equal(stderr.trim(), '');
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+/);
});
