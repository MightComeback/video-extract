import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const binPath = path.resolve(__dirname, '..', 'bin', 'fathom2action.js');

function run(args, { stdin } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [binPath, ...args], { timeout: 10_000 }, (err, stdout, stderr) => {
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

test('prints brief when given a URL', async () => {
  const url = 'https://example.com/fathom/share/abc';
  const { stdout } = await run([url]);
  assert.match(stdout, /# Bug brief/);
  assert.ok(stdout.includes(`Source: ${url}`));
  assert.match(stdout, /Suggested issue title/);
});

test('prints a helpful message when URL fetch fails', async () => {
  const url = 'http://localhost:1/fathom/share/abc';
  const { stdout } = await run([url]);
  assert.match(stdout, /Fetch: failed/);
  assert.match(stdout, /--stdin/);
});

test('reads stdin when --stdin is provided', async () => {
  const { stdout } = await run(['--stdin'], { stdin: 'hello world\n' });
  assert.match(stdout, /Source: stdin/);
  assert.match(stdout, /hello world/);
});

test('reads stdin when no args are provided but stdin is piped', async () => {
  const { stdout } = await run([], { stdin: 'piped input\n' });
  assert.match(stdout, /Source: stdin/);
  assert.match(stdout, /piped input/);
});

test('errors when --stdin is empty', async () => {
  await assert.rejects(
    () => run(['--stdin'], { stdin: '   \n' }),
    (err) => {
      assert.equal(err.code, 2);
      assert.match(err.stderr, /stdin is empty/);
      return true;
    }
  );
});
