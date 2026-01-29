import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const linearScript = path.join(repoRoot, 'scripts', 'linear.js');

function run(args, env = {}) {
  return spawnSync(process.execPath, [linearScript, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
  });
}

test('scripts/linear.js prints help with --help and exits 0 (no env required)', () => {
  const res = run(['--help'], { LINEAR_API_KEY: '' });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /Usage:\s*\n\s*node scripts\/linear\.js issue-state-type/i);
});

test('scripts/linear.js exits non-zero on unknown command and prints help', () => {
  const res = run(['wat']);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /Unknown command/i);
  assert.match(res.stdout, /Usage:/i);
});

test('scripts/linear.js exits non-zero when missing issue key', () => {
  const res = run(['issue-state-type']);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /Missing issue key/i);
});
