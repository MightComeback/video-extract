import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const briefBinPath = path.resolve(__dirname, '..', 'bin', 'fathom2action-brief.js');

function runBrief(args, { timeoutMs = 30_000, cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [briefBinPath, ...args],
      { timeout: timeoutMs, cwd, env: { ...process.env, ...(env || {}) } },
      (err, stdout, stderr) => {
        if (err) {
          err.stdout = stdout;
          err.stderr = stderr;
          return reject(err);
        }
        resolve({ stdout, stderr });
      }
    );
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

test('brief CLI accepts angle-bracket wrapped URLs (chat/markdown copy-paste)', async () => {
  const { stdout, stderr } = await runBrief(['<http://localhost:1/share/abc>']);
  assert.ok(stdout.length > 0);
  assert.match(stderr, /NOTE: Unable to fetch this link/i);
  assert.match(stdout, /Source: http:\/\/localhost:1\/share\/abc/);
});

test('brief CLI accepts Slack-style wrapped URLs (<url|label>)', async () => {
  const { stdout, stderr } = await runBrief(['<http://localhost:1/share/abc|Fathom>']);
  assert.ok(stdout.length > 0);
  assert.match(stderr, /NOTE: Unable to fetch this link/i);
  assert.match(stdout, /Source: http:\/\/localhost:1\/share\/abc/);
});

test('brief CLI supports --out to write the generated brief to a file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fathom2action-'));
  const outPath = path.join(dir, 'brief.md');

  const { stdout } = await runBrief(['<http://localhost:1/share/abc>', '--out', outPath]);
  const file = fs.readFileSync(outPath, 'utf8');

  assert.ok(stdout.length > 0);
  assert.ok(file.length > 0);
  assert.equal(file.trim(), stdout.trim());
});

test('brief CLI treats --out - as stdout (does not create a file named "-")', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fathom2action-'));

  const { stdout } = await runBrief(['<http://localhost:1/share/abc>', '--out', '-'], { cwd: dir });

  assert.ok(stdout.length > 0);
  assert.equal(fs.existsSync(path.join(dir, '-')), false);
});

test('brief CLI supports env vars to hide teaser/timestamps (F2A_MAX_*)', async () => {
  const { stdout } = await runBrief(['<http://localhost:1/share/abc>'], {
    env: { F2A_MAX_TEASER: '0', F2A_MAX_TIMESTAMPS: '0' },
  });

  assert.ok(stdout.length > 0);
  assert.equal(stdout.includes('## Transcript teaser'), false);
  assert.equal(stdout.includes('## Timestamps'), false);
});
