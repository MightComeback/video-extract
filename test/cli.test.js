import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const binPath = path.resolve(__dirname, '..', 'bin', 'fathom2action.js');
const extractBinPath = path.resolve(__dirname, '..', 'bin', 'fathom2action-extract.js');
const transformBinPath = path.resolve(__dirname, '..', 'bin', 'fathom2action-transform.js');

function runBin(bin, args, { stdin } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [bin, ...args], { timeout: 10_000 }, (err, stdout, stderr) => {
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

function run(args, opts) {
  return runBin(binPath, args, opts);
}

function runExtract(args, opts) {
  return runBin(extractBinPath, args, opts);
}

function runTransform(args, opts) {
  return runBin(transformBinPath, args, opts);
}

test('prints version when --version is provided', async () => {
  const { stdout } = await run(['--version']);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

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

test('strips HTML when given an HTML page', async () => {
  const html = '<html><head><title>Demo &amp; Test</title></head><body><h1>Hello</h1><p>World<br/>Line</p></body></html>';
  const url = `data:text/html,${encodeURIComponent(html)}`;
  const { stdout } = await run([url]);
  assert.match(stdout, /Source: data:text\/html/);
  // Title should be extracted.
  assert.match(stdout, /- Demo & Test/);
  // Tags should not leak into raw extract.
  assert.ok(!stdout.includes('<h1>'));
  assert.match(stdout, /Hello/);
  assert.match(stdout, /World/);
  assert.match(stdout, /Line/);
});

test('extracts og:title when <title> is missing', async () => {
  const html = '<html><head><meta property="og:title" content="OG Demo &amp; Title"/></head><body><p>Hi</p></body></html>';
  const url = `data:text/html,${encodeURIComponent(html)}`;
  const { stdout } = await run([url]);
  assert.match(stdout, /- OG Demo & Title/);
});

test('falls back to <h1> when no <title> or meta title is present', async () => {
  const html = '<html><head></head><body><h1>H1 &amp; Title</h1><p>Hi</p></body></html>';
  const url = `data:text/html,${encodeURIComponent(html)}`;
  const { stdout } = await run([url]);
  assert.match(stdout, /- H1 & Title/);
});

test('decodes numeric HTML entities in extracted title', async () => {
  const html = '<html><head><title>Ivan&#39;s &#x2019;Demo&#8217;</title></head><body><p>Hi</p></body></html>';
  const url = `data:text/html,${encodeURIComponent(html)}`;
  const { stdout } = await run([url]);
  assert.match(stdout, /- Ivan's ’Demo’/);
});

test('prefers embedded transcript JSON over tag-stripped HTML when present', async () => {
  const html = `
    <html>
      <head><title>Embedded Transcript</title></head>
      <body>
        <h1>Ignore me</h1>
        <script id="__NEXT_DATA__" type="application/json">
          {"props":{"pageProps":{"transcript":[{"text":"First line"},{"text":"Second line"}]}}}
        </script>
      </body>
    </html>
  `;
  const url = `data:text/html,${encodeURIComponent(html)}`;
  const { stdout } = await runExtract([url]);
  const obj = JSON.parse(stdout);
  assert.equal(obj.ok, true);
  assert.match(obj.text, /First line/);
  assert.match(obj.text, /Second line/);
  // We should still extract a title.
  assert.equal(obj.title, 'Embedded Transcript');
});

test('reads stdin when --stdin is provided', async () => {
  const { stdout } = await run(['--stdin'], { stdin: 'hello world\n' });
  assert.match(stdout, /Source: stdin/);
  assert.match(stdout, /hello world/);
});

test('allows overriding stdin source with --source', async () => {
  const { stdout } = await run(['--stdin', '--source', 'https://fathom.video/share/xyz'], { stdin: 'notes\n' });
  assert.match(stdout, /Source: https:\/\/fathom\.video\/share\/xyz/);
  assert.match(stdout, /notes/);
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

test('extract tool returns JSON', async () => {
  const { stdout } = await runExtract(['--stdin', '--source', 'demo'], { stdin: 'hello\n' });
  const obj = JSON.parse(stdout);
  assert.equal(obj.ok, true);
  assert.equal(obj.source, 'demo');
  assert.match(obj.text, /hello/);
});

test('extract tool includes a title field when parsing HTML', async () => {
  const html = '<html><head><title>Demo &amp; Test</title></head><body><p>Hi</p></body></html>';
  const url = `data:text/html,${encodeURIComponent(html)}`;
  const { stdout } = await runExtract([url]);
  const obj = JSON.parse(stdout);
  assert.equal(obj.ok, true);
  assert.equal(obj.title, 'Demo & Test');
});

test('transform tool can render markdown from extractor JSON', async () => {
  const extracted = { ok: true, source: 'demo', text: 'hello world', suggestedTitle: 'Demo' };
  const { stdout } = await runTransform(['--json'], { stdin: JSON.stringify(extracted) });
  assert.match(stdout, /# Bug brief/);
  assert.match(stdout, /Source: demo/);
  assert.match(stdout, /hello world/);
  assert.match(stdout, /- Demo/);
});

test('transform tool can render markdown from raw text stdin', async () => {
  const { stdout } = await runTransform(['--stdin', '--source', 'demo'], { stdin: 'notes here\n' });
  assert.match(stdout, /Source: demo/);
  assert.match(stdout, /notes here/);
});
