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

test('brief CLI accepts bare fathom.video URLs (no scheme) and normalizes to https://', async () => {
  const { stdout, stderr } = await runBrief(['fathom.video/share/abc']);
  assert.ok(stdout.length > 0);
  assert.match(stderr, /NOTE: Unable to fetch this link/i);
  assert.match(stdout, /Source: https:\/\/fathom\.video\/share\/abc/);
});

test('brief CLI prints version with --version', async () => {
  const { stdout, stderr } = await runBrief(['--version']);
  assert.equal(stderr.trim(), '');
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+/);
});

test('brief CLI documents --copy-brief in --help output', async () => {
  const { stdout } = await runBrief(['--help']);
  assert.match(stdout, /--copy-brief/);
});

test('brief CLI help mentions chat/markdown URL wrappers', async () => {
  const { stdout } = await runBrief(['--help']);
  assert.match(stdout, /paste URLs directly from chat\/markdown/i);
  assert.match(stdout, /<https:\/\//i);
  assert.match(stdout, /\[label\]\(https:\/\//i);
});

test('brief CLI supports --json (outputs {source,title,brief})', async () => {
  const { stdout, stderr } = await runBrief(['<http://localhost:1/share/abc>', '--json']);
  assert.match(stderr, /NOTE: Unable to fetch this link/i);

  const parsed = JSON.parse(stdout);
  assert.equal(parsed.source, 'http://localhost:1/share/abc');
  assert.equal(typeof parsed.title, 'string');
  assert.equal(typeof parsed.brief, 'string');
  assert.match(parsed.brief, /# Bug report brief/);
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

test('brief CLI accepts Slack-style wrapped URLs even when surrounded by chat punctuation', async () => {
  const { stdout, stderr } = await runBrief(['(<http://localhost:1/share/abc|Fathom>)']);
  assert.ok(stdout.length > 0);
  assert.match(stderr, /NOTE: Unable to fetch this link/i);
  assert.match(stdout, /Source: http:\/\/localhost:1\/share\/abc/);
});

test('brief CLI accepts markdown link URLs ([label](url))', async () => {
  const { stdout, stderr } = await runBrief(['[Fathom](http://localhost:1/share/abc)']);
  assert.ok(stdout.length > 0);
  assert.match(stderr, /NOTE: Unable to fetch this link/i);
  assert.match(stdout, /Source: http:\/\/localhost:1\/share\/abc/);
});

test('brief CLI strips common trailing chat punctuation from URLs', async () => {
  {
    const { stdout, stderr } = await runBrief(['http://localhost:1/share/abc!)']);
    assert.ok(stdout.length > 0);
    assert.match(stderr, /NOTE: Unable to fetch this link/i);
    assert.match(stdout, /Source: http:\/\/localhost:1\/share\/abc\b/);
  }

  {
    const { stdout, stderr } = await runBrief(['http://localhost:1/share/abc…！？。']);
    assert.ok(stdout.length > 0);
    assert.match(stderr, /NOTE: Unable to fetch this link/i);
    assert.match(stdout, /Source: http:\/\/localhost:1\/share\/abc\b/);
  }

  {
    // Common when copy/pasting from some locales / apps.
    const { stdout, stderr } = await runBrief(['http://localhost:1/share/abc»）』']);
    assert.ok(stdout.length > 0);
    assert.match(stderr, /NOTE: Unable to fetch this link/i);
    assert.match(stdout, /Source: http:\/\/localhost:1\/share\/abc\b/);
  }
});

test('brief CLI strips parenthetical labels after URLs', async () => {
  const { stdout, stderr } = await runBrief(['http://localhost:1/share/abc (Fathom)']);
  assert.ok(stdout.length > 0);
  assert.match(stderr, /NOTE: Unable to fetch this link/i);
  assert.match(stdout, /Source: http:\/\/localhost:1\/share\/abc\b/);
});

test('brief CLI accepts smart-quoted URLs (common mobile copy/paste)', async () => {
  const { stdout, stderr } = await runBrief(['“http://localhost:1/share/abc”']);
  assert.ok(stdout.length > 0);
  assert.match(stderr, /NOTE: Unable to fetch this link/i);
  assert.match(stdout, /Source: http:\/\/localhost:1\/share\/abc/);
});

test('brief CLI accepts guillemet-wrapped URLs (locale quotes)', async () => {
  const { stdout, stderr } = await runBrief(['«http://localhost:1/share/abc»']);
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

test('brief CLI ignores empty env var overrides for F2A_MAX_* (treats as unset)', async () => {
  const { stdout } = await runBrief(['<http://localhost:1/share/abc>'], {
    env: { F2A_MAX_TEASER: '', F2A_MAX_TIMESTAMPS: '   ' },
  });

  assert.ok(stdout.length > 0);
  // Defaults should apply, so the sections should still be present.
  assert.match(stdout, /## Transcript teaser/);
  assert.match(stdout, /## Timestamps/);
});

test('brief CLI supports env var to enable clipboard copy (F2A_COPY)', async () => {
  const { stdout, stderr } = await runBrief(['<http://localhost:1/share/abc>'], {
    // Force clipboard commands to be missing so we can assert on stderr deterministically.
    env: { F2A_COPY: '1', PATH: '/nonexistent' },
  });

  assert.ok(stdout.length > 0);
  assert.match(stderr, /NOTE: --copy requested but no clipboard command was found/i);
});
