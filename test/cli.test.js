import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const binPath = path.resolve(__dirname, '..', 'bin', 'fathom2action.js');
const extractBinPath = path.resolve(__dirname, '..', 'bin', 'fathom2action-extract.js');
const transformBinPath = path.resolve(__dirname, '..', 'bin', 'fathom2action-transform.js');

function runBin(bin, args, { stdin, timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [bin, ...args], { timeout: timeoutMs }, (err, stdout, stderr) => {
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

function withServer(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
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
  assert.match(stdout, /- Ivan\'s ’Demo’/);
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

test('slices transcript section from tag-stripped HTML when a Transcript header is present', async () => {
  const html = `
    <html>
      <head><title>Share Page</title></head>
      <body>
        <h2>Chapters</h2>
        <p>00:00 Intro</p>
        <h2>Transcript</h2>
        <p>00:01 Ivan: Hello there</p>
        <p>00:02 Might: Hi</p>
        <h2>Notes</h2>
        <p>Some notes</p>
      </body>
    </html>
  `;
  const url = `data:text/html,${encodeURIComponent(html)}`;
  const { stdout } = await runExtract([url]);
  const obj = JSON.parse(stdout);
  assert.equal(obj.ok, true);
  assert.match(obj.text, /00:01/);
  assert.match(obj.text, /Hello there/);
  assert.ok(!/Chapters/i.test(obj.text));
  assert.ok(!/Some notes/i.test(obj.text));
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

test('extract tool includes a mediaUrl field when og:video is present (without downloading)', async () => {
  const html = '<html><head><meta property="og:video" content="https://cdn.example.com/video.mp4"/></head><body><p>Hi</p></body></html>';
  const url = `data:text/html,${encodeURIComponent(html)}`;
  const { stdout } = await runExtract([url, '--no-download']);
  const obj = JSON.parse(stdout);
  assert.equal(obj.ok, true);
  assert.equal(obj.mediaUrl, 'https://cdn.example.com/video.mp4');
});

test('extract tool writes transcript.txt + extracted.json when --out-dir is provided (even with --no-download)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fathom2action-test-'));
  const outDir = path.join(tmp, 'out');

  const html = '<html><head><title>Demo</title></head><body><p>Hello transcript</p></body></html>';
  const url = `data:text/html,${encodeURIComponent(html)}`;

  const { stdout } = await runExtract([url, '--out-dir', outDir, '--no-download', '--pretty']);
  const obj = JSON.parse(stdout);
  assert.equal(obj.ok, true);
  assert.equal(obj.artifactsDir, outDir);
  assert.ok(obj.transcriptPath);
  assert.ok(obj.extractedJsonPath);
  assert.ok(fs.existsSync(obj.transcriptPath));
  assert.ok(fs.existsSync(obj.extractedJsonPath));

  const transcript = fs.readFileSync(obj.transcriptPath, 'utf8');
  assert.match(transcript, /Hello transcript/);

  const meta = JSON.parse(fs.readFileSync(obj.extractedJsonPath, 'utf8'));
  assert.equal(meta.ok, true);
  assert.equal(meta.artifactsDir, outDir);
});

test('extract tool can download + split media into segments (local server)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fathom2action-test-'));
  const srcVideo = path.join(tmp, 'src.mp4');

  // Small deterministic MP4 with frequent keyframes (for copy-based segmentation).
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=64x64:rate=10',
    '-t',
    '12',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-g',
    '10',
    '-keyint_min',
    '10',
    '-sc_threshold',
    '0',
    '-an',
    srcVideo,
  ]);

  const videoBytes = fs.readFileSync(srcVideo);

  let srv;
  srv = await withServer((req, res) => {
    if (req.url === '/page') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(`<html><head><title>Demo</title><meta property="og:video" content="${srv.url}/video.mp4"/></head><body>Hi</body></html>`);
      return;
    }

    if (req.url === '/video.mp4') {
      res.statusCode = 200;
      res.setHeader('content-type', 'video/mp4');
      res.end(videoBytes);
      return;
    }

    res.statusCode = 404;
    res.end('not found');
  });

  try {
    const outDir = path.join(tmp, 'out');
    const { stdout } = await runExtract([`${srv.url}/page`, '--out-dir', outDir, '--split-seconds', '5', '--pretty'], {
      timeoutMs: 120_000,
    });
    const obj = JSON.parse(stdout);
    assert.equal(obj.ok, true);
    assert.equal(obj.title, 'Demo');
    assert.ok(obj.mediaUrl.includes('/video.mp4'));
    assert.ok(obj.mediaPath);
    assert.ok(fs.existsSync(obj.mediaPath));
    assert.equal(obj.segmentSeconds, 5);
    assert.ok(Array.isArray(obj.mediaSegments));
    assert.ok(obj.mediaSegments.length >= 2);
    for (const p of obj.mediaSegments) assert.ok(fs.existsSync(p));
  } finally {
    await srv.close();
  }
});

test('extract tool supports --download-media <path> as an alias for setting the mp4 output path', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fathom2action-test-'));
  const srcVideo = path.join(tmp, 'src.mp4');

  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=64x64:rate=10',
    '-t',
    '3',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-g',
    '10',
    '-keyint_min',
    '10',
    '-sc_threshold',
    '0',
    '-an',
    srcVideo,
  ]);

  const videoBytes = fs.readFileSync(srcVideo);

  let srv;
  srv = await withServer((req, res) => {
    if (req.url === '/page') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(`<html><head><title>Demo</title><meta property="og:video" content="${srv.url}/video.mp4"/></head><body>Hi</body></html>`);
      return;
    }

    if (req.url === '/video.mp4') {
      res.statusCode = 200;
      res.setHeader('content-type', 'video/mp4');
      res.end(videoBytes);
      return;
    }

    res.statusCode = 404;
    res.end('not found');
  });

  const outPath = path.join(tmp, 'custom.mp4');
  try {
    const { stdout } = await runExtract([`${srv.url}/page`, '--download-media', outPath, '--no-split', '--pretty'], {
      timeoutMs: 120_000,
    });
    const obj = JSON.parse(stdout);
    assert.equal(obj.ok, true);
    assert.equal(obj.mediaPath, outPath);
    assert.ok(fs.existsSync(outPath));
  } finally {
    await srv.close();
  }
});

test('extract tool can pass cookies when fetching an auth-gated HTML page', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fathom2action-test-'));
  const cookieFile = path.join(tmp, 'cookie.txt');
  fs.writeFileSync(cookieFile, 'session=abc123', 'utf8');

  let srv;
  srv = await withServer((req, res) => {
    if (req.url === '/page') {
      const c = req.headers.cookie || '';
      if (!String(c).includes('session=abc123')) {
        res.statusCode = 401;
        res.end('unauthorized');
        return;
      }
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end('<html><head><title>Cookie OK</title></head><body><p>Transcript here</p></body></html>');
      return;
    }

    res.statusCode = 404;
    res.end('not found');
  });

  try {
    const { stdout } = await runExtract([`${srv.url}/page`, '--cookie-file', cookieFile, '--no-download', '--pretty']);
    const obj = JSON.parse(stdout);
    assert.equal(obj.ok, true);
    assert.equal(obj.title, 'Cookie OK');
    assert.match(obj.text, /Transcript here/);
  } finally {
    await srv.close();
  }
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
