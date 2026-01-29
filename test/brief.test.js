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
  // Teaser strips leading timestamps for readability.
  assert.match(stdout, /^- Alice: It crashes/m);
  assert.match(stdout, /^- Bob: Yep/m);
});

test('brief --stdin treats a leading URL line as the Source', async () => {
  const url = 'https://fathom.video/share/abc';
  const { stdout } = await runBrief(['--stdin'], {
    stdin: [url, '00:01 Alice: It crashes', ''].join('\n'),
  });

  assert.match(stdout, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(stdout, /^- Alice: It crashes/m);
});

test('brief --stdin treats a single URL line as the Source (empty transcript)', async () => {
  const url = 'https://fathom.video/share/only-url';
  const { stdout } = await runBrief(['--stdin'], {
    stdin: [url, ''].join('\n'),
  });

  assert.match(stdout, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  // With no transcript, we should still render an empty teaser placeholder.
  assert.match(stdout, /^## Transcript teaser \(first lines\)/m);
});

test('brief --stdin accepts a Title line after the Source URL', async () => {
  const url = 'https://fathom.video/share/abc';
  const title = 'Login breaks on Safari';
  const { stdout } = await runBrief(['--stdin'], {
    stdin: [url, `Title: ${title}`, '00:01 Alice: It crashes', ''].join('\n'),
  });

  assert.match(stdout, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(stdout, new RegExp(`^Title: ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(stdout, /^- Alice: It crashes/m);
});
