#!/usr/bin/env node
import process from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { readStdin, extractFromStdin, extractFromUrl, getVersion } from '../src/extractor.js';
import { renderBrief } from '../src/brief.js';

function usage(code = 0) {
  const cmd = process.argv[1]?.split('/').pop() || 'fathom2action';
  console.log(`${cmd}

Usage:
  ${cmd} <fathom-share-url> [--copy] [--out <path>] [--no-note] [--max-teaser <n>] [--max-timestamps <n>]
  ${cmd} --stdin [--copy] [--out <path>] [--source <url>] [--title <text>] [--max-teaser <n>] [--max-timestamps <n>]
  ${cmd} - [--copy] [--out <path>] [--source <url>] [--title <text>] [--max-teaser <n>] [--max-timestamps <n>]

Options:
  --copy            Also copy the generated brief to clipboard (best-effort; tries pbcopy, wl-copy, xclip, or xsel).
  --out <path>      Also write the generated brief to a file.
  --source <url>    Override the Source field (useful when piping transcript via --stdin).
  --title <text>    Override the Title field (useful when piping transcript via --stdin).
  --no-note              Suppress the "NOTE: Unable to fetch..." hint printed to stderr when a link can't be fetched.
  --max-teaser <n>        Max number of transcript teaser bullets to render (default: 6; use 0 to hide).
  --max-timestamps <n>    Max number of timestamps to render (default: 6; use 0 to hide).

Notes:
  - If the URL cannot be fetched (auth-gated), the tool will print a ready-to-paste brief and ask for transcript via ${cmd} --stdin.
`);
  process.exit(code);
}

async function main() {
  const cmd = process.argv[1]?.split('/').pop() || 'fathom2action';
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) usage(0);
  if (args.includes('-v') || args.includes('--version')) {
    process.stdout.write(`${getVersion()}\n`);
    return;
  }

  const copyToClipboard = args.includes('--copy');
  const suppressNote = args.includes('--no-note');

  function takeFlagValue(flag) {
    const idx = args.indexOf(flag);
    if (idx === -1) return undefined;
    const value = args[idx + 1];
    if (!value || value.startsWith('-')) {
      process.stderr.write(`ERROR: ${flag} requires a value\n`);
      usage(2);
    }
    // Remove flag + value from args in-place.
    args.splice(idx, 2);
    return value;
  }

  const sourceOverride = takeFlagValue('--source');
  const titleOverride = takeFlagValue('--title');
  const outPath = takeFlagValue('--out');
  const maxTeaserRaw = takeFlagValue('--max-teaser');
  const maxTimestampsRaw = takeFlagValue('--max-timestamps');

  function parseNonNegInt(name, v) {
    if (v == null) return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      process.stderr.write(`ERROR: ${name} must be a non-negative integer (got: ${v})\n`);
      usage(2);
    }
    return n;
  }

  const maxTeaser = parseNonNegInt('--max-teaser', maxTeaserRaw);
  const maxTimestamps = parseNonNegInt('--max-timestamps', maxTimestampsRaw);

  const cleanArgs = args.filter(
    (a) => a !== '--copy' && a !== '--no-note' && a !== '--max-teaser' && a !== '--max-timestamps'
  );

  function maybeWriteFile(text) {
    if (!outPath) return;
    const p = path.resolve(process.cwd(), String(outPath));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, String(text), 'utf8');
  }

  async function maybeCopy(text) {
    if (!copyToClipboard) return;

    // Best-effort clipboard copy.
    // Tries common clipboard CLIs in order:
    // - macOS: pbcopy
    // - Wayland: wl-copy
    // - X11: xclip / xsel
    const candidates = [
      { cmd: 'pbcopy', args: [] },
      // Windows (Git Bash / WSL): clipboard helper
      { cmd: 'clip.exe', args: [] },
      { cmd: 'clip', args: [] },
      { cmd: 'wl-copy', args: [] },
      { cmd: 'xclip', args: ['-selection', 'clipboard'] },
      { cmd: 'xsel', args: ['--clipboard', '--input'] },
    ];

    async function tryCommand(cmd, args) {
      return await new Promise((resolve) => {
        const child = spawn(cmd, args);
        child.on('error', (err) => {
          // Not installed? try the next candidate.
          if (err?.code === 'ENOENT') return resolve(false);
          process.stderr.write(`NOTE: --copy failed (${cmd}): ${String(err?.message || err)}\n`);
          // Clipboard command exists but failed; keep trying other candidates.
          resolve(false);
        });
        child.on('close', (code) => resolve(code === 0));
        try {
          child.stdin.write(String(text));
          child.stdin.end();
        } catch {
          resolve(false);
        }
      });
    }

    for (const c of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await tryCommand(c.cmd, c.args);
      if (ok) return;
    }

    process.stderr.write(
      'NOTE: --copy requested but no clipboard command was found (tried pbcopy, clip.exe/clip, wl-copy, xclip, xsel).\n'
    );
  }

  async function renderFromStdin() {
    const content = await readStdin();
    try {
      const extracted = extractFromStdin({ content, source: 'stdin' });
      const out = renderBrief({
        cmd,
        source: sourceOverride || extracted.source,
        title: titleOverride || extracted.title,
        transcript: extracted.text,
        teaserMax: maxTeaser,
        timestampsMax: maxTimestamps,
      });
      await maybeCopy(out);
      maybeWriteFile(out);
      process.stdout.write(`${out}\n`);
    } catch (e) {
      if (e && e.code === 2) {
        process.stderr.write(
          `ERROR: stdin is empty. Paste a transcript (or a URL + transcript) and try again. Example: \`pbpaste | ${cmd} --stdin\`\n`
        );
        process.exit(2);
      }
      throw e;
    }
  }

  // Convenience: no args + piped stdin.
  if (!cleanArgs.length && !process.stdin.isTTY) {
    await renderFromStdin();
    return;
  }

  if (!cleanArgs.length) usage(0);

  if (cleanArgs[0] === '--stdin' || cleanArgs[0] === '-') {
    await renderFromStdin();
    return;
  }

  // URL mode expects a single positional argument.
  if (cleanArgs.length > 1) {
    process.stderr.write(`ERROR: unexpected extra arguments: ${cleanArgs.slice(1).join(' ')}\n`);
    usage(2);
  }

  function cleanUrl(u) {
    let out = String(u || '').trim();
    if (!out) return '';

    // Allow chat/markdown-friendly wrappers like:
    //   <https://...>
    const m = out.match(/^<\s*(https?:\/\/[^>\s]+)\s*>$/i);
    if (m) out = m[1];

    // Strip common trailing punctuation from copy/paste:
    //   https://...)
    //   https://...,;
    out = out.replace(/[)\]>'\".,;:]+$/g, '');
    return out;
  }

  const url = cleanUrl(cleanArgs[0]);
  if (!/^https?:\/\//i.test(url)) {
    process.stderr.write(`ERROR: expected a URL starting with http(s):// (got: ${cleanArgs[0]})\n`);
    usage(2);
  }

  const extracted = await extractFromUrl(url, {
    // Keep this lightweight: we only need the transcript for a brief.
    downloadMedia: false,
    splitSeconds: 0,
  });

  const brief = renderBrief({
    cmd,
    source: sourceOverride || extracted.source,
    title: titleOverride || extracted.title,
    transcript: extracted.text,
    fetchError: extracted.fetchError,
    teaserMax: maxTeaser,
    timestampsMax: maxTimestamps,
  });

  // If we couldn't fetch anything useful, nudge toward --stdin.
  if (!extracted.ok && !suppressNote) {
    process.stderr.write(
      `NOTE: Unable to fetch this link (often auth-gated). Paste transcript via \`${cmd} --stdin\` for best results. Example: \`pbpaste | ${cmd} --stdin\`.\n`
    );
  }

  await maybeCopy(brief);
  maybeWriteFile(brief);
  process.stdout.write(`${brief}\n`);
}

main().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
