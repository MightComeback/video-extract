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
  ${cmd} <url> [--pretty] [--out-dir <dir>] [--split-seconds 300] [--no-download] [--no-split] [--cookie <header-or-pairs>] [--cookie-file <path>] [--referer <url>] [--user-agent <ua>] [--download-media <path>]
  ${cmd} --stdin [--source <url-or-label>] [--pretty]
  ${cmd} - [--source <url-or-label>] [--pretty]

Output:
  Prints JSON with transcript + media artifacts (best-effort):
    { ok, source, text, title, suggestedTitle, mediaUrl, artifactsDir, transcriptPath, extractedJsonPath, mediaPath, mediaSegmentsDir, mediaSegments, mediaSegmentsListPath, segmentSeconds, fetchError, mediaDownloadError }

Notes:
  - Default (URL mode): if mediaUrl is found, it will download a local mp4 and split into 5-minute segments (300s).
  - If --out-dir is set, the extractor will also write transcript.txt + extracted.json for easy piping to other tools.
  - For auth-gated links, pass a Cookie header via --cookie/FATHOM_COOKIE, or a cookie file via FATHOM_COOKIE_FILE/--cookie-file.
  - For pages that require a Referer header, use --referer or set FATHOM_REFERER.
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

function parseCookieFileContents(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';

  const lines = s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  // If a user pasted headers (common copy/paste from DevTools), prefer an explicit Cookie: line.
  // Accept both single-line and multi-line inputs.
  // Also handle a multi-line copy where "Cookie:" is on its own line and the value is on the next line.
  const cookieHeaderLine = lines.find((l) => /^cookie\s*:/i.test(l));
  if (cookieHeaderLine) {
    const m = cookieHeaderLine.match(/^cookie\s*:\s*(.*)$/i);
    const v = String(m?.[1] || '').trim();
    if (v) return cookieHeaderLine;

    // "Cookie:" with no value — take the next non-empty line as the value.
    const i = lines.indexOf(cookieHeaderLine);
    const next = lines.slice(i + 1).find((l) => l && !/^\w+\s*:/i.test(l));
    if (next) return `Cookie: ${next}`;

    return cookieHeaderLine;
  }

  // Netscape cookies.txt format (7 tab-separated fields).
  // domain  flag  path  secure  expiration  name  value
  const netscapePairs = [];
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length >= 7) {
      const name = parts[5];
      const value = parts.slice(6).join('\t');
      if (name) netscapePairs.push(`${name}=${value}`);
    }
  }
  if (netscapePairs.length) return netscapePairs.join('; ');

  // One cookie per line: name=value
  const simplePairs = [];
  for (const line of lines) {
    if (!line.includes('=')) continue;
    // Avoid treating JSON as cookies.
    if (line.startsWith('{') || line.startsWith('[')) continue;
    simplePairs.push(line);
  }
  if (simplePairs.length) return simplePairs.join('; ');

  // JSON cookies (common exports from browser extensions/devtools).
  // Accept either:
  //  - [{"name":"foo","value":"bar"}, ...]
  //  - {"cookies":[{"name":"foo","value":"bar"}, ...]}
  try {
    const parsed = JSON.parse(s);
    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.cookies) ? parsed.cookies : null;
    if (Array.isArray(arr)) {
      const pairs = [];
      for (const c of arr) {
        const name = String(c?.name || '').trim();
        const value = String(c?.value || '').trim();
        if (name) pairs.push(`${name}=${value}`);
      }
      if (pairs.length) return pairs.join('; ');
    }
  } catch {
    // ignore
  }

  // Fall back to raw.
  return s;
}

function loadCookie({ cookie, cookieFile } = {}) {
  // Precedence:
  //  1) explicit --cookie
  //  2) --cookie-file / FATHOM_COOKIE_FILE
  //  3) FATHOM_COOKIE
  let c = cookie ? String(cookie) : '';

  // Convenience: allow env var to point at a cookie file.
  if (!cookieFile && process.env.FATHOM_COOKIE_FILE) cookieFile = String(process.env.FATHOM_COOKIE_FILE);

  if (!c && cookieFile) {
    try {
      c = fs.readFileSync(cookieFile, 'utf8');
    } catch (e) {
      console.error(`ERR: failed to read cookie file: ${cookieFile}`);
      console.error(String(e?.message || e));
      process.exit(2);
    }
  }

  if (!c && process.env.FATHOM_COOKIE) c = String(process.env.FATHOM_COOKIE);

  c = parseCookieFileContents(c);
  c = String(c || '').trim();
  return c || null;
}

async function main() {
  maybeWarnDeprecatedAlias();

  let args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) usage(0);
  if (args.includes('-v') || args.includes('--version')) {
    // Keep parity with other CLIs.
    const { getVersion } = await import('../src/extractor.js');
    console.log(getVersion());
    return;
  }

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

  const envSplit = process.env.FATHOM_SPLIT_SECONDS != null ? Number(process.env.FATHOM_SPLIT_SECONDS) : null;
  const splitSeconds = splitFlag.value != null ? Number(splitFlag.value) : (Number.isFinite(envSplit) ? envSplit : 300);
  if (splitFlag.value != null && (!Number.isFinite(splitSeconds) || splitSeconds <= 0)) {
    console.error('ERR: --split-seconds must be a positive number');
    process.exit(2);
  }

  if (splitFlag.value == null && envSplit != null && (!Number.isFinite(envSplit) || envSplit <= 0)) {
    console.error('ERR: FATHOM_SPLIT_SECONDS must be a positive number');
    process.exit(2);
  }

  const cookieFlag = readFlagValue(args, '--cookie');
  args = cookieFlag.args;

  const cookieFileFlag = readFlagValue(args, '--cookie-file');
  args = cookieFileFlag.args;

  const cookie = loadCookie({ cookie: cookieFlag.value, cookieFile: cookieFileFlag.value });

  const refererFlag = readFlagValue(args, '--referer');
  args = refererFlag.args;
  // Allow env default for convenience in scripts.
  const envReferer = String(process.env.FATHOM_REFERER || '').trim();
  const referer = refererFlag.value ? String(refererFlag.value) : envReferer || null;

  const userAgentFlag = readFlagValue(args, '--user-agent');
  args = userAgentFlag.args;
  const userAgent = userAgentFlag.value;

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

  function cleanUrl(u) {
    let out = String(u || '').trim();
    if (!out) return '';

    // Allow chat/markdown-friendly wrappers like:
    //   <https://...>
    //   <https://...|label>
    //   [label](https://...)
    //   [label](data:...)

    // Slack: <https://...|label>
    const slack = out.match(/^<\s*((?:https?:\/\/|data:)[^|>\s]+)\s*\|[^>]*>$/i);
    if (slack) out = slack[1];

    // Angle brackets: <https://...>
    const m = out.match(/^<\s*((?:https?:\/\/|data:)[^>\s]+)\s*>$/i);
    if (m) out = m[1];

    // Markdown link: [label](https://...)
    const md = out.match(/^\[[^\]]*\]\(\s*((?:https?:\/\/|data:)[^)\s]+)\s*\)$/i);
    if (md) out = md[1];

    // Strip common trailing punctuation from copy/paste:
    //   https://...)
    //   https://...,;
    //   https://...!? (common in chat)
    out = out.replace(/[)\]>'\"`.,;:!?]+$/g, '');
    return out;
  }

  const url = cleanUrl(args[0]);
  // For tests and convenience, allow `data:` URLs too.
  if (!/^https?:\/\//i.test(url) && !/^data:/i.test(url)) {
    console.error(`ERR: expected a URL starting with http(s):// or data: (got: ${args[0]})`);
    process.exit(2);
  }

  const extracted = await extractFromUrl(url, {
    downloadMedia: !noDownload,
    splitSeconds: noSplit ? 0 : splitSeconds,
    outDir: downloadMediaPath ? path.dirname(downloadMediaPath) : outDir,
    cookie,
    referer,
    userAgent,
    mediaOutPath: downloadMediaPath,
  });

  console.log(JSON.stringify(extracted, null, pretty ? 2 : 0));
}

main().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
