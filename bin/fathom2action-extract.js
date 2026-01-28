#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { readStdin, extractFromStdin, extractFromUrl } from '../src/extractor.js';

function maybeWarnDeprecatedAlias() {
  const cmd = process.argv[1]?.split('/').pop() || '';
  if (/^fathom2action-?extract/i.test(cmd)) {
    console.error(`WARN: '${cmd}' is deprecated. Prefer 'fathom-extract' (same behavior).`);
  }
}

function usage(code = 0) {
  const cmd = process.argv[1]?.split('/').pop() || 'fathom-extract';
  console.log(`${cmd}

Usage:
  ${cmd} <url> [--pretty] [--out-dir <dir>] [--split-seconds 300] [--no-download] [--no-split] [--cookie-file <path>] [--download-media <path>]
  ${cmd} --stdin [--source <url-or-label>] [--pretty]
  ${cmd} - [--source <url-or-label>] [--pretty]

Output:
  Prints JSON with transcript + media artifacts (best-effort):
    { ok, source, text, title, suggestedTitle, mediaUrl, artifactsDir, mediaPath, mediaSegments, segmentSeconds, fetchError, mediaDownloadError }

Notes:
  - Default (URL mode): if mediaUrl is found, it will download a local mp4 and split into 5-minute segments (300s).
  - For auth-gated links, pass a Cookie header via FATHOM_COOKIE or --cookie-file.
  - --download-media <path> is a convenience alias that sets the downloaded mp4 output path.
`);
  process.exit(code);
}

function readFlagValue(args, flag) {
  const i = args.indexOf(flag);
  if (i === -1) return { args, value: null };
  const v = args[i + 1];
  if (!v || v.startsWith('-')) {
    console.error(`ERR: ${flag} requires a value`);
    process.exit(2);
  }
  const next = args.slice(0, i).concat(args.slice(i + 2));
  return { args: next, value: v };
}

function popFlag(args, flag) {
  if (!args.includes(flag)) return { args, present: false };
  return { args: args.filter((a) => a !== flag), present: true };
}

function loadCookie({ cookieFile } = {}) {
  let c = process.env.FATHOM_COOKIE ? String(process.env.FATHOM_COOKIE) : '';
  if (cookieFile) {
    try {
      c = fs.readFileSync(cookieFile, 'utf8');
    } catch (e) {
      console.error(`ERR: failed to read cookie file: ${cookieFile}`);
      console.error(String(e?.message || e));
      process.exit(2);
    }
  }
  c = String(c || '').trim();
  return c || null;
}

async function main() {
  maybeWarnDeprecatedAlias();

  let args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) usage(0);

  const prettyFlag = popFlag(args, '--pretty');
  args = prettyFlag.args;
  const pretty = prettyFlag.present;

  const noDownloadFlag = popFlag(args, '--no-download');
  args = noDownloadFlag.args;
  const noDownload = noDownloadFlag.present;

  const noSplitFlag = popFlag(args, '--no-split');
  args = noSplitFlag.args;
  const noSplit = noSplitFlag.present;

  const outDirFlag = readFlagValue(args, '--out-dir');
  args = outDirFlag.args;
  const outDir = outDirFlag.value;

  const splitFlag = readFlagValue(args, '--split-seconds');
  args = splitFlag.args;
  const splitSeconds = splitFlag.value != null ? Number(splitFlag.value) : 300;
  if (splitFlag.value != null && (!Number.isFinite(splitSeconds) || splitSeconds <= 0)) {
    console.error('ERR: --split-seconds must be a positive number');
    process.exit(2);
  }

  const cookieFileFlag = readFlagValue(args, '--cookie-file');
  args = cookieFileFlag.args;
  const cookie = loadCookie({ cookieFile: cookieFileFlag.value });

  const sourceFlag = readFlagValue(args, '--source');
  args = sourceFlag.args;
  const stdinSourceOverride = sourceFlag.value;

  const downloadFlag = readFlagValue(args, '--download-media');
  args = downloadFlag.args;
  const downloadMediaPath = downloadFlag.value ? path.resolve(downloadFlag.value) : null;

  // Convenience: if no args and stdin is piped, treat it like --stdin.
  if (!args.length) {
    if (!process.stdin.isTTY) {
      if (downloadMediaPath) {
        console.error('ERR: --download-media can only be used with a URL input');
        process.exit(2);
      }
      const content = await readStdin();
      const extracted = extractFromStdin({ content, source: stdinSourceOverride || 'stdin' });
      console.log(JSON.stringify(extracted, null, pretty ? 2 : 0));
      return;
    }
    usage(0);
  }

  if (args[0] === '--stdin' || args[0] === '-') {
    if (downloadMediaPath) {
      console.error('ERR: --download-media can only be used with a URL input');
      process.exit(2);
    }

    const content = await readStdin();
    try {
      const extracted = extractFromStdin({ content, source: stdinSourceOverride || 'stdin' });
      console.log(JSON.stringify(extracted, null, pretty ? 2 : 0));
      return;
    } catch (e) {
      if (e?.code === 2) {
        console.error('ERR: stdin is empty');
        process.exit(2);
      }
      throw e;
    }
  }

  if (stdinSourceOverride) {
    console.error('ERR: --source can only be used with --stdin (or piped stdin)');
    process.exit(2);
  }

  const url = args[0];

  const extracted = await extractFromUrl(url, {
    downloadMedia: !noDownload,
    splitSeconds: noSplit ? 0 : splitSeconds,
    outDir: downloadMediaPath ? path.dirname(downloadMediaPath) : outDir,
    cookie,
    mediaOutPath: downloadMediaPath,
  });

  console.log(JSON.stringify(extracted, null, pretty ? 2 : 0));
}

main().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
