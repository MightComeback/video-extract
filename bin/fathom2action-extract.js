#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractFromUrl, extractFromStdin, readStdin, cookieFromFile } from '../src/extractor.js';
import { normalizeUrlLike } from '../src/brief.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

const args = process.argv.slice(2);
const help = args.includes('--help') || args.includes('-h');
const showVersion = args.includes('--version') || args.includes('-v');

if (showVersion) {
  console.log(pkg.version);
  process.exit(0);
}

if (help) {
  console.log(`
Usage: fathom-extract <url> [options]
       fathom-extract --stdin < transcript.txt

Options:
  --out-dir <dir>        Write transcript.txt + extracted.json + media artifacts
  --cookie <str>         Cookie header value (e.g. "auth_token=...")
  --cookie-file <path>   Read Cookie header from file (supports JSON export / Cookie: header)
  --referer <url>        Override Referer header for fetch + ffmpeg
  --user-agent <ua>      Override User-Agent header for fetch + ffmpeg
  --split-seconds <n>    Segment size in seconds (default: FATHOM_SPLIT_SECONDS or 300)
  --no-download          Skip media download
  --no-split             Download media but do not split into segments
  --download-media <p>   Override mp4 output path
  --pretty               Pretty-print JSON
`);
  process.exit(0);
}

function parseValue(key) {
  const idx = args.indexOf(key);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return null;
}

const outDir = parseValue('--out-dir') || process.env.FATHOM_OUT_DIR || null;
let cookie = parseValue('--cookie') || process.env.FATHOM_COOKIE || '';
const cookieFile = parseValue('--cookie-file') || process.env.FATHOM_COOKIE_FILE || '';
const referer = parseValue('--referer') || process.env.FATHOM_REFERER || '';
const userAgent = parseValue('--user-agent') || process.env.FATHOM_USER_AGENT || '';
const splitSeconds = parseValue('--split-seconds') || process.env.FATHOM_SPLIT_SECONDS || null;
const noDownload = args.includes('--no-download');
const noSplit = args.includes('--no-split');
const mediaOutPath = parseValue('--download-media') || null;
const pretty = args.includes('--pretty');

if (cookieFile) {
  try {
    cookie = cookieFromFile(cookieFile);
  } catch (e) {
    console.error(`Error reading cookie file: ${e.message}`);
    process.exit(1);
  }
}

const positionals = args.filter((a, i) => {
  if (a.startsWith('--')) return false;
  const prev = args[i - 1];
  if (['--out-dir', '--cookie', '--cookie-file', '--referer', '--user-agent', '--split-seconds', '--download-media'].includes(prev)) return false;
  return true;
});

const url = positionals[0];
const stdinMode = args.includes('--stdin') || !url;

async function main() {
  let result;

  if (!stdinMode) {
    const normalizedUrl = normalizeUrlLike(url);
    result = await extractFromUrl(normalizedUrl, {
      outDir,
      cookie,
      referer,
      userAgent,
      splitSeconds: splitSeconds != null ? Number(splitSeconds) : undefined,
      noDownload,
      noSplit,
      mediaOutPath,
      version: pkg.version,
    });
  } else {
    if (process.stdin.isTTY && !args.includes('--stdin')) {
      console.error('Error: No URL provided and no input piped directly (pass --stdin to force read).');
      process.exit(1);
    }
    const content = await readStdin();
    result = extractFromStdin({ content, source: url || 'stdin' });
  }

  const json = pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);
  console.log(json);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
