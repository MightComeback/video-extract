#!/usr/bin/env node

import { extractFromUrl, extractFromStdin, readStdin, formatCsv } from '../src/extractor.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const help = args.includes('--help') || args.includes('-h');
const showVersion = args.includes('--version') || args.includes('-v');

if (showVersion) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  console.log(pkg.version);
  process.exit(0);
}

if (help) {
  console.log(`
Usage: fathom-extract <url> [options]
       fathom-extract --stdin < transcript.txt

Options:
  --cookie <str>       Pass Cookie header (e.g. "auth_token=...")
  --cookie-file <path> Read Cookie header from file
  --json               Output JSON (default)
  --csv                Output CSV Line
  --download           Download media (mp4) if available
  --out-dir <dir>      Save artifacts (media, transcript) to directory
  --media-out <path>   Save media (mp4) to specific path
  --segment-sec <num>  Split media into N-second segments (default 300)
  --user-agent <str>   Custom User-Agent
`);
  process.exit(0);
}

const flags = {
  json: !args.includes('--csv'),
  csv: args.includes('--csv'),
  download: args.includes('--download'),
  cookie: null,
  cookieFile: null,
  outDir: null,
  mediaOut: null,
  segmentSeconds: 300,
  userAgent: null,
};

function parseValue(key) {
  const idx = args.indexOf(key);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return null;
}

flags.cookie = parseValue('--cookie');
flags.cookieFile = parseValue('--cookie-file');
flags.outDir = parseValue('--out-dir');
flags.mediaOut = parseValue('--media-out');
flags.userAgent = parseValue('--user-agent');
const seg = parseValue('--segment-sec');
if (seg) flags.segmentSeconds = parseInt(seg, 10);

// Consume flags to find the URL (positional)
const positionals = args.filter(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--cookie' && args[args.indexOf(a) - 1] !== '--cookie-file' && args[args.indexOf(a) - 1] !== '--out-dir' && args[args.indexOf(a) - 1] !== '--media-out' && args[args.indexOf(a) - 1] !== '--segment-sec' && args[args.indexOf(a) - 1] !== '--user-agent');
const url = positionals[0];
const stdinMode = args.includes('--stdin') || !url;

if (flags.cookieFile) {
  try {
    const raw = fs.readFileSync(flags.cookieFile, 'utf8').trim();
    if (raw) flags.cookie = raw;
  } catch (e) {
    console.error(`Error reading cookie file: ${e.message}`);
    process.exit(1);
  }
}

async function main() {
  let result;
  if (url && !args.includes('--stdin')) {
    result = await extractFromUrl(url, {
      cookie: flags.cookie,
      downloadMedia: flags.download,
      outDir: flags.outDir,
      mediaOutPath: flags.mediaOut,
      splitSeconds: flags.segmentSeconds,
      userAgent: flags.userAgent,
    });
  } else {
    // Stdin mode
    if (process.stdin.isTTY && !args.includes('--stdin')) {
       console.error('Error: No URL provided and no input piped directly (pass --stdin to force read).');
       process.exit(1);
    }
    const content = await readStdin();
    try {
      result = extractFromStdin({ content, source: url || 'stdin' });
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  }

  if (flags.csv) {
    console.log(formatCsv(result));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
