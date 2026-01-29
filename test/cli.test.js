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

// Primary CLI (extract-only)
const extractBinPath = path.resolve(__dirname, '..', 'bin', 'fathom2action-extract.js');

// Legacy wrapper (kept for backwards compatibility)
const legacyBinPath = path.resolve(__dirname, '..', 'bin', 'fathom2action.js');

function runBin(bin, args, { stdin, timeoutMs = 30_000, env = null } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [bin, ...args],
      { timeout: timeoutMs, env: env ? { ...process.env, ...env } : process.env },
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

function runExtract(args, opts) {
  return runBin(extractBinPath, args, opts);
}

function runLegacy(args, opts) {
  return runBin(legacyBinPath, args, opts);
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

test('legacy wrapper prints version when --version is provided', async () => {
  const { stdout } = await runLegacy(['--version']);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('legacy wrapper behaves like brief generator (markdown output)', async () => {
  const url = 'https://example.com/fathom/share/abc';
  const { stdout, stderr } = await runLegacy([url]);

  // Brief is markdown, not JSON.
  assert.match(stdout, /# Bug report brief/);
  assert.match(stdout, new RegExp(`Source: ${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

  // When fetch fails (likely), we should nudge toward --stdin.
  assert.match(stderr, /NOTE: Unable to fetch/);
});

test('still writes stub artifacts when URL fetch fails and --out-dir is provided', async () => {
  const url = 'http://localhost:1/fathom/share/abc';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fathom-extract-fail-'));

  const { stdout } = await runExtract([url, '--out-dir', tmp, '--no-download']);
  const obj = JSON.parse(stdout);
  assert.equal(obj.ok, false);
  assert.equal(obj.artifactsDir, tmp);
  assert.ok(obj.transcriptPath);

  const transcript = fs.readFileSync(obj.transcriptPath, 'utf8');
  assert.match(transcript, /Unable to fetch this link/);
  assert.match(transcript, /Fetch error:/);
  assert.match(transcript, /FATHOM_COOKIE/);
});

test('supports auth-gated pages via FATHOM_COOKIE', async () => {
  const s = await withServer((req, res) => {
    const cookie = String(req.headers.cookie || '');
    if (!cookie.includes('auth=1')) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden');
      return;
    }

    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><head><title>Private Recording</title></head><body><p>hello transcript</p></body></html>');
  });

  try {
    // Without cookie → 403.
    const { stdout: noCookieOut } = await runExtract([`${s.url}/share/abc`, '--no-download']);
    const noCookieObj = JSON.parse(noCookieOut);
    assert.equal(noCookieObj.ok, false);
    assert.match(String(noCookieObj.fetchError || ''), /HTTP 403/);

    // With cookie → OK.
    const { stdout: withCookieOut } = await runExtract([`${s.url}/share/abc`, '--no-download'], { env: { FATHOM_COOKIE: 'auth=1' } });
    const withCookieObj = JSON.parse(withCookieOut);
    assert.equal(withCookieObj.ok, true);
    assert.match(withCookieObj.title, /Private Recording/);
  } finally {
    await s.close();
  }
});

test('extract CLI accepts chat-wrapped URLs (angle brackets / Slack links) and strips trailing punctuation', async () => {
  const s = await withServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><head><title>OK</title></head><body><p>hi</p></body></html>');
  });

  try {
    const base = `${s.url}/x`;

    // <https://...>
    const { stdout: angleOut } = await runExtract([`<${base}>`, '--no-download']);
    assert.equal(JSON.parse(angleOut).ok, true);

    // Slack: <https://...|label>
    const { stdout: slackOut } = await runExtract([`<${base}|recording>`, '--no-download']);
    assert.equal(JSON.parse(slackOut).ok, true);

    // Markdown link: [label](https://...)
    const { stdout: mdOut } = await runExtract([`[Recording](${base})`, '--no-download']);
    assert.equal(JSON.parse(mdOut).ok, true);

    // Common chat punctuation (e.g., "...)")
    const { stdout: punctOut } = await runExtract([`${base})`, '--no-download']);
    assert.equal(JSON.parse(punctOut).ok, true);
  } finally {
    await s.close();
  }
});

test('cookie file supports JSON exports (name/value pairs)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fathom-cookie-json-'));
  const cookiePath = path.join(tmp, 'cookies.json');
  fs.writeFileSync(cookiePath, JSON.stringify([{ name: 'auth', value: '1' }], null, 2));

  const s = await withServer((req, res) => {
    const cookie = String(req.headers.cookie || '');
    if (!cookie.includes('auth=1')) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden');
      return;
    }

    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><head><title>OK</title></head><body><p>hi</p></body></html>');
  });

  try {
    const { stdout } = await runExtract([`${s.url}/x`, '--cookie-file', cookiePath, '--no-download']);
    const obj = JSON.parse(stdout);
    assert.equal(obj.ok, true);
    assert.equal(obj.title, 'OK');
  } finally {
    await s.close();
  }
});

test('cookie file supports a raw Cookie header (Cookie: ...)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fathom-cookie-header-'));
  const cookiePath = path.join(tmp, 'cookie.txt');
  fs.writeFileSync(cookiePath, 'Cookie: auth=1');

  const s = await withServer((req, res) => {
    const cookie = String(req.headers.cookie || '');
    if (!cookie.includes('auth=1')) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden');
      return;
    }

    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><head><title>OK</title></head><body><p>hi</p></body></html>');
  });

  try {
    const { stdout } = await runExtract([`${s.url}/x`, '--cookie-file', cookiePath, '--no-download']);
    const obj = JSON.parse(stdout);
    assert.equal(obj.ok, true);
    assert.equal(obj.title, 'OK');
  } finally {
    await s.close();
  }
});

test('cookie file supports a Cookie header line embedded among other headers', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fathom-cookie-header-multi-'));
  const cookiePath = path.join(tmp, 'cookie.txt');
  fs.writeFileSync(cookiePath, ['Host: fathom.video', 'Cookie: auth=1', 'Accept: */*', ''].join('\n'));

  const s = await withServer((req, res) => {
    const cookie = String(req.headers.cookie || '');
    if (!cookie.includes('auth=1')) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden');
      return;
    }

    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><head><title>OK</title></head><body><p>hi</p></body></html>');
  });

  try {
    const { stdout } = await runExtract([`${s.url}/x`, '--cookie-file', cookiePath, '--no-download']);
    const obj = JSON.parse(stdout);
    assert.equal(obj.ok, true);
    assert.equal(obj.title, 'OK');
  } finally {
    await s.close();
  }
});

test('sets mediaDownloadError when download is enabled but mediaUrl is missing', async () => {
  const html = '<html><head><title>No Video</title></head><body><h2>Transcript</h2><p>00:01 Hello</p></body></html>';
  const url = `data:text/html,${encodeURIComponent(html)}`;

  // Default behavior has download enabled; if we can't find a mediaUrl, we should still
  // surface a clear error in the JSON.
  const { stdout } = await runExtract([url, '--no-split']);
  const obj = JSON.parse(stdout);
  assert.equal(obj.ok, true);
  assert.equal(obj.mediaUrl, '');
  assert.match(String(obj.mediaDownloadError || ''), /mediaUrl not found/i);
});

test('extract tool resolves media URLs found in JSON (no extension) via content-type probe', async () => {
  let srv;
  srv = await withServer((req, res) => {
    if (req.url === '/page') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(
        `<html><head><title>JSON Media</title></head><body><script>window.__DATA__={"downloadUrl":"${srv.url}\/video"}</script></body></html>`
      );
      return;
    }

    if (req.url === '/video') {
      res.statusCode = 200;
      res.setHeader('content-type', 'video/mp4');
      res.end('not-a-real-mp4');
      return;
    }

    res.statusCode = 404;
    res.end('not found');
  });

  try {
    const { stdout } = await runExtract([`${srv.url}/page`, '--no-download', '--no-split', '--pretty']);
    const obj = JSON.parse(stdout);
    assert.equal(obj.ok, true);
    assert.equal(obj.title, 'JSON Media');
    assert.equal(obj.mediaUrl, `${srv.url}/video`);
  } finally {
    await srv.close();
  }
});

test('prefers copy_transcript endpoint when present (better transcript extraction)', async () => {
  let srv;
  srv = await withServer((req, res) => {
    if (req.url === '/page') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      // Deliberately do NOT include timestamps in the page body; we want the extractor to fetch copy_transcript.
      res.end(
        `<html><head><title>Copy Transcript</title></head><body><script>window.__DATA__={"copyTranscriptUrl":"${srv.url}\/copy_transcript"}</script><p>hello</p></body></html>`
      );
      return;
    }

    if (req.url === '/copy_transcript') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ html: '<div><p>00:01 Alice: Hello there</p><p>00:05 Bob: Hi</p></div>' }));
      return;
    }

    res.statusCode = 404;
    res.end('not found');
  });

  try {
    const { stdout } = await runExtract([`${srv.url}/page`, '--no-download', '--no-split', '--pretty']);
    const obj = JSON.parse(stdout);
    assert.equal(obj.ok, true);
    assert.equal(obj.title, 'Copy Transcript');
    assert.match(String(obj.text || ''), /00:01/);
    assert.match(String(obj.text || ''), /Alice/);
  } finally {
    await srv.close();
  }
});

test('passes cookie + referer + user-agent when downloading media with ffmpeg', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fathom-extract-headers-'));
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
      res.end(`<html><head><title>Headers</title><meta property="og:video" content="${srv.url}/video.mp4"/></head><body>Hi</body></html>`);
      return;
    }

    if (req.url === '/video.mp4') {
      const cookie = String(req.headers.cookie || '');
      const ua = String(req.headers['user-agent'] || '');
      const ref = String(req.headers.referer || '');

      if (!cookie.includes('auth=1')) {
        res.statusCode = 403;
        res.end('missing cookie');
        return;
      }
      if (!/\bfathom-extract\//.test(ua)) {
        res.statusCode = 403;
        res.end('missing/incorrect user-agent');
        return;
      }
      if (!ref.endsWith('/page')) {
        res.statusCode = 403;
        res.end('missing/incorrect referer');
        return;
      }

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
    const { stdout } = await runExtract([`${srv.url}/page`, '--out-dir', outDir, '--split-seconds', '2', '--pretty'], {
      timeoutMs: 120_000,
      env: { FATHOM_COOKIE: 'auth=1' },
    });
    const obj = JSON.parse(stdout);
    assert.equal(obj.ok, true);
    assert.ok(obj.mediaPath);
    assert.ok(fs.existsSync(obj.mediaPath));
    assert.ok(Array.isArray(obj.mediaSegments));
    assert.ok(obj.mediaSegments.length >= 1);

    assert.ok(obj.mediaSegmentsListPath);
    assert.ok(fs.existsSync(obj.mediaSegmentsListPath));
    const list = fs.readFileSync(obj.mediaSegmentsListPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    assert.equal(list.length, obj.mediaSegments.length);
    assert.equal(list[0], obj.mediaSegments[0]);
  } finally {
    await srv.close();
  }
});

test('supports --user-agent to override UA for media download', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fathom-extract-ua-'));
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
  const customUa = 'CustomUA/1.0';

  let srv;
  srv = await withServer((req, res) => {
    if (req.url === '/page') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(`<html><head><title>UA</title><meta property="og:video" content="${srv.url}/video.mp4"/></head><body>Hi</body></html>`);
      return;
    }

    if (req.url === '/video.mp4') {
      const cookie = String(req.headers.cookie || '');
      const ua = String(req.headers['user-agent'] || '');
      const ref = String(req.headers.referer || '');

      if (!cookie.includes('auth=1')) {
        res.statusCode = 403;
        res.end('missing cookie');
        return;
      }
      if (ua !== customUa) {
        res.statusCode = 403;
        res.end('missing/incorrect user-agent');
        return;
      }
      if (!ref.endsWith('/page')) {
        res.statusCode = 403;
        res.end('missing/incorrect referer');
        return;
      }

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
    const { stdout } = await runExtract([`${srv.url}/page`, '--out-dir', outDir, '--split-seconds', '2', '--user-agent', customUa, '--pretty'], {
      timeoutMs: 120_000,
      env: { FATHOM_COOKIE: 'auth=1' },
    });
    const obj = JSON.parse(stdout);
    assert.equal(obj.ok, true);
    assert.ok(obj.mediaPath);
    assert.ok(fs.existsSync(obj.mediaPath));
  } finally {
    await srv.close();
  }
});

test('extract tool can download + split media into segments (local server)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fathom-extract-test-'));
  const srcVideo = path.join(tmp, 'src.mp4');

  // Small deterministic MP4 with frequent keyframes.
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

    assert.ok(obj.mediaSegmentsListPath);
    assert.ok(fs.existsSync(obj.mediaSegmentsListPath));
    const list = fs.readFileSync(obj.mediaSegmentsListPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    assert.equal(list.length, obj.mediaSegments.length);
    assert.equal(list[0], obj.mediaSegments[0]);
  } finally {
    await srv.close();
  }
});

test('supports --referer for pages that require a Referer header', async () => {
  const s = await withServer((req, res) => {
    const referer = String(req.headers.referer || '');
    if (!referer.includes('https://fathom.video/')) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('missing referer');
      return;
    }

    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><head><title>Referer OK</title></head><body><p>hello transcript</p></body></html>');
  });

  try {
    const { stdout } = await runExtract([`${s.url}/share/abc`, '--referer', 'https://fathom.video/', '--no-download']);
    const obj = JSON.parse(stdout);
    assert.equal(obj.ok, true);
    assert.equal(obj.title, 'Referer OK');
  } finally {
    await s.close();
  }
});

test('supports FATHOM_REFERER env var for pages that require a Referer header', async () => {
  const s = await withServer((req, res) => {
    const referer = String(req.headers.referer || '');
    if (!referer.includes('https://fathom.video/')) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('missing referer');
      return;
    }

    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<html><head><title>Env Referer OK</title></head><body><p>hello transcript</p></body></html>');
  });

  try {
    const { stdout } = await runExtract([`${s.url}/share/abc`, '--no-download'], {
      env: { FATHOM_REFERER: 'https://fathom.video/' },
    });
    const obj = JSON.parse(stdout);
    assert.equal(obj.ok, true);
    assert.equal(obj.title, 'Env Referer OK');
  } finally {
    await s.close();
  }
});
