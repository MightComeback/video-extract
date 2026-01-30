import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { renderBrief } from '../src/brief.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const briefBinPath = path.resolve(__dirname, '..', 'bin', 'fathom2action-brief.js');

function runBrief(args, { stdin, timeoutMs = 20_000, cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
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
  assert.match(stdout, /^## Attachments \/ evidence/m);
  assert.match(stdout, /^## Timestamps/m);
  assert.match(stdout, /^- 00:01 — /m);
  assert.match(stdout, /^- 00:05 — /m);
  assert.match(stdout, /^## Next actions/m);
  assert.match(stdout, /^## Transcript teaser \(first lines\)/m);
  // Teaser strips leading timestamps + speaker labels for readability.
  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief supports limiting teaser bullets and timestamps via flags', async () => {
  const { stdout } = await runBrief(['--stdin', '--max-teaser', '2', '--max-timestamps', '1'], {
    stdin: ['00:01 Alice: First', '00:02 Bob: Second', '00:03 Carol: Third', ''].join('\n'),
  });

  // Only 1 timestamp line should be rendered.
  const ts = stdout.match(/^- \d{1,2}:\d{2}(?::\d{2})? — /gm) || [];
  assert.equal(ts.length, 1);

  // Only 2 teaser bullets should be rendered.
  const teaser = stdout.match(/^- (First|Second|Third)$/gm) || [];
  assert.equal(teaser.length, 2);
});

test('brief allows hiding timestamps/teaser sections via --max-*=0', async () => {
  const { stdout } = await runBrief(['--stdin', '--max-teaser', '0', '--max-timestamps', '0'], {
    stdin: ['00:01 Alice: First', '00:02 Bob: Second', ''].join('\n'),
  });

  assert.doesNotMatch(stdout, /^## Timestamps/m);
  assert.doesNotMatch(stdout, /^## Transcript teaser \(first lines\)/m);
  // Still includes the main sections.
  assert.match(stdout, /^## Next actions/m);
});

test('brief teaser strips speaker labels with punctuation', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['00:01 QA-1: Repro is flaky', "00:02 Ivan K.: Yep", ''].join('\n'),
  });

  assert.match(stdout, /^- Repro is flaky/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief teaser strips speaker labels even without a space after colon', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['00:01 Alice:It crashes', '00:02 Bob:Yep', ''].join('\n'),
  });

  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief teaser strips timestamps when followed by a dot separator', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['00:01. Alice: It crashes', '00:02. Bob: Yep', ''].join('\n'),
  });

  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief teaser strips speaker labels with fullwidth colon (：)', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['00:01 Alice： It crashes', '00:02 Bob：Yep', ''].join('\n'),
  });

  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief teaser strips non-ASCII speaker labels (e.g. Cyrillic)', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['00:01 Іван: Привіт', '00:02 María: Hola', ''].join('\n'),
  });

  assert.match(stdout, /^- Привіт/m);
  assert.match(stdout, /^- Hola/m);
});

test('brief teaser strips speaker labels with role metadata (parens/brackets)', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['00:01 Alice (Host): It crashes', '00:02 Bob [PM] - Yep', ''].join('\n'),
  });

  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief teaser strips speaker labels when dash separator has no spaces', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['00:01 Alice—It crashes', '00:02 Bob—Yep', ''].join('\n'),
  });

  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief teaser strips numbered list prefixes with non-ASCII separators (e.g. 1． / 1、)', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['1． 00:01 Alice: It crashes', '2、 00:02 Bob: Yep', ''].join('\n'),
  });

  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief normalizes Source URLs with leading quote prefixes (> ...)', () => {
  const brief = renderBrief({
    source: '> <https://example.com/path?q=1>',
    title: 'Test',
    transcript: '',
  });

  assert.match(brief, /^Source: https:\/\/example\.com\/path\?q=1$/m);
  assert.match(brief, /^- Fathom: https:\/\/example\.com\/path\?q=1$/m);
});

test('brief normalizes Source URLs when argument is prefixed with "Source:"', () => {
  const brief = renderBrief({
    source: 'Source: <https://example.com/path?q=1>',
    title: 'Test',
    transcript: '',
  });

  assert.match(brief, /^Source: https:\/\/example\.com\/path\?q=1$/m);
  assert.match(brief, /^- Fathom: https:\/\/example\.com\/path\?q=1$/m);
});

test('brief normalizes Source URLs when argument is prefixed with "Fathom:"', () => {
  const brief = renderBrief({
    source: 'Fathom: <https://example.com/path?q=1>',
    title: 'Test',
    transcript: '',
  });

  assert.match(brief, /^Source: https:\/\/example\.com\/path\?q=1$/m);
  assert.match(brief, /^- Fathom: https:\/\/example\.com\/path\?q=1$/m);
});

test('brief --stdin treats a leading URL line as the Source', async () => {
  const url = 'https://fathom.video/share/abc';
  const { stdout } = await runBrief(['--stdin'], {
    stdin: [url, '00:01 Alice: It crashes', ''].join('\n'),
  });

  assert.match(stdout, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(stdout, /^- It crashes/m);
});

test('brief normalizes source URLs with trailing backticks', () => {
  const url = 'https://example.com/path';
  const md = renderBrief({
    source: `${url}\``,
    title: 'Test',
    transcript: '00:01 Alice: Hi',
  });

  assert.match(md, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
});

test('brief normalizes source URLs with leading wrappers', () => {
  const url = 'https://example.com/path';
  const md = renderBrief({
    source: `(${url})`,
    title: 'Test',
    transcript: '00:01 Alice: Hi',
  });

  assert.match(md, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
});

test('brief normalizes Slack-style angle URLs with labels + trailing punctuation', () => {
  const url = 'https://example.com/path?q=1';
  const md = renderBrief({
    source: `(<${url}|Example>)`,
    title: 'Test',
    transcript: '00:01 Alice: Hi',
  });

  assert.match(md, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
});

test('brief --stdin treats a "Source: <url>" line as the Source', async () => {
  const url = 'https://fathom.video/share/source-prefixed';
  const { stdout } = await runBrief(['--stdin'], {
    stdin: [`Source: ${url}`, '00:01 Alice: It crashes', ''].join('\n'),
  });

  assert.match(stdout, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(stdout, /^- It crashes/m);
});

test('brief --stdin treats a "Link: <url>" line as the Source', async () => {
  const url = 'https://fathom.video/share/link-prefixed';
  const { stdout } = await runBrief(['--stdin'], {
    stdin: [`Link: ${url}`, '00:01 Alice: It crashes', ''].join('\n'),
  });

  assert.match(stdout, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(stdout, /^- It crashes/m);
});

test('brief --stdin treats a "URL: <url>" line as the Source', async () => {
  const url = 'https://fathom.video/share/url-prefixed';
  const { stdout } = await runBrief(['--stdin'], {
    stdin: [`URL: ${url}`, '00:01 Alice: It crashes', ''].join('\n'),
  });

  assert.match(stdout, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(stdout, /^- It crashes/m);
});

test('brief --stdin accepts markdown link Sources like "[label](url)"', async () => {
  const url = 'https://fathom.video/share/mdlink';
  const { stdout } = await runBrief(['--stdin'], {
    stdin: [`[Fathom](${url})`, '00:01 Alice: It crashes', ''].join('\n'),
  });

  assert.match(stdout, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(stdout, /^- It crashes/m);
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

test('brief renders a non-empty Links placeholder when Source is unknown', () => {
  const out = renderBrief({
    // Intentionally omit `source`.
    title: 'Some bug',
    transcript: '00:01 Alice: It crashes',
  });

  assert.match(out, /^## Links/m);
  assert.match(out, /^- \(add Fathom link\)$/m);
});

test('brief uses provided cmd name in "How to update this brief" section', () => {
  const out = renderBrief({
    cmd: 'mycmd',
    title: 'Some bug',
    transcript: '00:01 Alice: It crashes',
  });

  assert.match(out, /## How to update this brief/);
  assert.match(out, /re-run `mycmd "<link>"`/);
  assert.match(out, /pbpaste \| mycmd --stdin/);
});

test('brief --stdin accepts a Title line after the Source URL', async () => {
  const url = 'https://fathom.video/share/abc';
  const title = 'Login breaks on Safari';
  const { stdout } = await runBrief(['--stdin'], {
    stdin: [url, `Title: ${title}`, '00:01 Alice: It crashes', ''].join('\n'),
  });

  assert.match(stdout, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(stdout, new RegExp(`^Title: ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(stdout, /^- It crashes/m);
});

test('brief --stdin accepts Title-first followed by Source URL (copy/paste friendly)', async () => {
  const url = 'https://fathom.video/share/title-first';
  const title = 'Something broke';
  const { stdout } = await runBrief(['--stdin'], {
    stdin: [`Title: ${title}`, url, '00:01 Alice: It crashes', ''].join('\n'),
  });

  assert.match(stdout, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(stdout, new RegExp(`^Title: ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(stdout, /^- It crashes/m);
});

test('brief --stdin allows overriding Source and Title via flags', async () => {
  const url = 'https://fathom.video/share/override-me';
  const title = 'Overridden title';
  const { stdout } = await runBrief(['--stdin', '--source', url, '--title', title], {
    stdin: ['00:01 Alice: It crashes', ''].join('\n'),
  });

  assert.match(stdout, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(stdout, new RegExp(`^Title: ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(stdout, /^- It crashes/m);
});

test('brief strips angle brackets from Source (copy/paste-friendly URLs)', () => {
  const url = 'https://fathom.video/share/angle-brackets';
  const out = renderBrief({
    source: `<${url}>`,
    title: 'Some bug',
    transcript: '00:01 Alice: It crashes',
  });

  assert.match(out, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.match(out, new RegExp(`^- Fathom: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.doesNotMatch(out, /<https?:\/\//);
});

test('brief strips trailing punctuation from Source URLs (chat copy/paste)', () => {
  const url = 'https://fathom.video/share/trailing-punct';

  {
    const out = renderBrief({
      source: `${url}),`,
      title: 'Some bug',
      transcript: '00:01 Alice: It crashes',
    });

    assert.match(out, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
    assert.match(out, new RegExp(`^- Fathom: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }

  {
    const out = renderBrief({
      source: `${url}!`,
      title: 'Some bug',
      transcript: '00:01 Alice: It crashes',
    });

    assert.match(out, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
    assert.match(out, new RegExp(`^- Fathom: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }

  {
    const out = renderBrief({
      source: `${url}?`,
      title: 'Some bug',
      transcript: '00:01 Alice: It crashes',
    });

    assert.match(out, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
    assert.match(out, new RegExp(`^- Fathom: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }

  {
    const out = renderBrief({
      source: `${url}…！？。`,
      title: 'Some bug',
      transcript: '00:01 Alice: It crashes',
    });

    assert.match(out, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
    assert.match(out, new RegExp(`^- Fathom: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
});

test('brief teaser accepts Unicode bullet prefixes (•) and strips timestamps', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['• 00:01 Alice: It crashes', '• 00:05 Bob: Yep', ''].join('\n'),
  });

  assert.match(stdout, /^## Transcript teaser \(first lines\)/m);
  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief teaser accepts additional Unicode bullet prefixes (·/●/◦)', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['· 00:01 Alice: It crashes', '● 00:05 Bob: Yep', '◦ 00:09 Carol: Third', ''].join('\n'),
  });

  assert.match(stdout, /^## Transcript teaser \(first lines\)/m);
  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
  assert.match(stdout, /^- Third/m);
});

test('brief teaser accepts additional Unicode bullet prefixes (▪/‣)', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['▪ 00:01 Alice: It crashes', '‣ 00:05 Bob: Yep', ''].join('\n'),
  });

  assert.match(stdout, /^## Transcript teaser \(first lines\)/m);
  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief teaser accepts Unicode dash bullet prefixes (–/—)', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['– 00:01 Alice: It crashes', '— 00:05 Bob: Yep', ''].join('\n'),
  });

  assert.match(stdout, /^## Transcript teaser \(first lines\)/m);
  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief teaser accepts bullets even without a space after the bullet', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['•00:01 Alice: It crashes', '-00:05 Bob: Yep', ''].join('\n'),
  });

  assert.match(stdout, /^## Transcript teaser \(first lines\)/m);
  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief teaser strips common separators after timestamps (dash / em dash)', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['00:01 - Alice: It crashes', '00:05 — Bob: Yep', ''].join('\n'),
  });

  assert.match(stdout, /^## Transcript teaser \(first lines\)/m);
  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief teaser accepts numbered list prefixes (1. / 2))', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['1. 00:01 Alice: It crashes', '2) 00:05 Bob: Yep', ''].join('\n'),
  });

  assert.match(stdout, /^## Transcript teaser \(first lines\)/m);
  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief --stdin exits with code 2 and a helpful message when stdin is empty', async () => {
  await assert.rejects(
    runBrief(['--stdin'], {
      stdin: '\n',
    }),
    (err) => {
      assert.equal(err.code, 2);
      assert.match(String(err.stderr || ''), /stdin is empty/i);
      assert.match(String(err.stderr || ''), /pbpaste \|/i);
      return true;
    }
  );
});

test('brief --stdin allows empty stdin when --source/--title overrides are provided (template mode)', async () => {
  const { stdout } = await runBrief(['--stdin', '--source', 'https://fathom.video/share/ABC', '--title', 'Some bug'], {
    stdin: '\n',
  });

  assert.match(stdout, /^Source: https:\/\/fathom\.video\/share\/ABC$/m);
  assert.match(stdout, /^Title: Some bug$/m);
});

test('brief --stdin allows empty stdin when F2A_SOURCE/F2A_TITLE env overrides are provided (template mode)', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: '\n',
    env: { F2A_SOURCE: 'https://fathom.video/share/XYZ', F2A_TITLE: 'Env title bug' },
  });

  assert.match(stdout, /^Source: https:\/\/fathom\.video\/share\/XYZ$/m);
  assert.match(stdout, /^Title: Env title bug$/m);
});

test('brief teaser strips bracketed/parenthesized timestamps', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['[00:01] Alice: It crashes', '(00:05) Bob: Yep', ''].join('\n'),
  });

  assert.match(stdout, /^## Transcript teaser \(first lines\)/m);
  assert.match(stdout, /^- It crashes/m);
  assert.match(stdout, /^- Yep/m);
});

test('brief teaser de-dupes repeated transcript lines', async () => {
  const { stdout } = await runBrief(['--stdin'], {
    stdin: ['00:01 Alice: It crashes', '00:02 Bob: It crashes', '00:03 Alice: It CRASHES', ''].join('\n'),
  });

  // Only one bullet for the repeated content.
  const matches = stdout.match(/^- It crashes$/gm) || [];
  assert.equal(matches.length, 1);
});

test('brief timestamps extraction does not skip timestamps at the start of a new line', () => {
  const out = renderBrief({
    title: 'Some bug',
    transcript: ['foo 00:01', '00:05 bar', ''].join('\n'),
  });

  // Both timestamps should appear.
  assert.match(out, /^- 00:01 — /m);
  assert.match(out, /^- 00:05 — /m);
});

test('brief normalizes data: URLs in Source (useful for tests/local repros)', () => {
  const url = 'data:text/plain,hello';
  const out = renderBrief({
    source: `(<${url}|local>)`,
    title: 'Test',
    transcript: '00:01 Alice: Hi',
  });

  assert.match(out, new RegExp(`^Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
});

test('brief renders gracefully with minimal/undefined inputs (MIG-14 resilience)', () => {
  const out = renderBrief({
    source: undefined,
    title: undefined,
    date: undefined,
    transcript: undefined,
    fetchError: undefined,
  });

  assert.match(out, /^# Bug report brief/m);
  assert.match(out, /^Source: \(unknown\)/m);
  assert.match(out, /^Title: \(unknown\)/m);
  assert.match(out, /^- \(add Fathom link\)$/m);
  assert.match(out, /^## Next actions/m);
});

test('brief renders fetch error when present', () => {
  const out = renderBrief({
    fetchError: '404 Not Found',
  });
  assert.match(out, /^Fetch error: 404 Not Found/m);
});
