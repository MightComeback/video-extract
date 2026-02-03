import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFile, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extractBinPath = path.resolve(__dirname, '..', 'bin', 'fathom2action-extract.js');

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

async function makeTestVideo(outPath) {
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=64x64:rate=10',
      '-t',
      '8',
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
      outPath,
    ]);
    let err = '';
    child.stderr.on('data', (d) => (err += String(d)));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err || `ffmpeg exited ${code}`))));
  });
}

test('video-extract can produce a precise clip (--clip-from + --clip-seconds)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'video-extract-clip-test-'));
  const srcVideo = path.join(tmp, 'src.mp4');
  await makeTestVideo(srcVideo);
  const videoBytes = fs.readFileSync(srcVideo);

  let srv;
  srv = await withServer((req, res) => {
    if (req.url === '/page') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(`<html><head><title>ClipDemo</title><meta property="og:video" content="${srv.url}/video.mp4"/></head><body>Hi</body></html>`);
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
    const { stdout } = await runExtract([
      `${srv.url}/page`,
      '--out-dir',
      outDir,
      '--no-split',
      '--clip-from',
      '0:02',
      '--clip-seconds',
      '2',
      '--pretty',
    ], { timeoutMs: 120_000 });

    const obj = JSON.parse(stdout);
    assert.equal(obj.ok, true);
    assert.ok(obj.mediaPath);
    assert.ok(fs.existsSync(obj.mediaPath));

    assert.ok(obj.clipPath, 'clipPath is set');
    assert.ok(fs.existsSync(obj.clipPath), 'clip file exists');
    assert.ok(fs.statSync(obj.clipPath).size > 0, 'clip file non-empty');

    assert.equal(obj.clipFromSeconds, 2);
    assert.equal(obj.clipSeconds, 2);
    assert.equal(obj.clipError, '');
  } finally {
    await srv.close();
  }
});
