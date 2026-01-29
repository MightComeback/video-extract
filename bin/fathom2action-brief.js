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
  ${cmd} <fathom-share-url> [--copy] [--copy-brief] [--out <path>] [--json] [--no-note] [--max-teaser <n>] [--max-timestamps <n>]
  ${cmd} --stdin [--copy] [--copy-brief] [--out <path>] [--json] [--source <url>] [--title <text>] [--max-teaser <n>] [--max-timestamps <n>]
  ${cmd} - [--copy] [--copy-brief] [--out <path>] [--json] [--source <url>] [--title <text>] [--max-teaser <n>] [--max-timestamps <n>]

Options:
  --copy                 Also copy to clipboard (best-effort; tries pbcopy, wl-copy, xclip, or xsel). If used with --json, copies the markdown brief.
  --copy-brief           Copy the markdown brief to clipboard (even if --json is used).
  --out <path>           Also write the generated output to a file.
  --json                 Output a JSON object with { source, title, brief } instead of markdown.
  --source <url>         Override the Source field (useful when piping transcript via --stdin).
  --title <text>         Override the Title field (useful when piping transcript via --stdin).
  --no-note              Suppress the "NOTE: Unable to fetch..." hint printed to stderr when a link can't be fetched.
  --max-teaser <n>       Max number of transcript teaser bullets to render (default: 6; use 0 to hide).
  --max-timestamps <n>   Max number of timestamps to render (default: 6; use 0 to hide).

Env:
  F2A_MAX_TEASER         Default for --max-teaser (flags win).
  F2A_MAX_TIMESTAMPS     Default for --max-timestamps (flags win).
  F2A_COPY              If truthy (1/true/yes/on), behave as if --copy was passed.
  F2A_COPY_BRIEF        If truthy (1/true/yes/on), behave as if --copy-brief was passed.

Notes:
  - You can paste URLs directly from chat/markdown, e.g. <https://...>, <https://...|label>, or [label](https://...). Trailing punctuation is ignored.
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

  function truthyEnv(name) {
    const v = String(process.env[name] || '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 'on';
  }

  const copyToClipboard = args.includes('--copy') || truthyEnv('F2A_COPY');
  const copyBriefOnly = args.includes('--copy-brief') || truthyEnv('F2A_COPY_BRIEF');
  const outputJson = args.includes('--json');

  // UX: if the user asks to copy output while also requesting --json, it's almost always
  // more useful to copy the rendered markdown brief (the thing you paste into Linear/GitHub)
  // rather than the JSON wrapper.
  const copyBriefWhenJson = copyToClipboard && outputJson && !copyBriefOnly;
  const suppressNote = args.includes('--no-note');

  function takeFlagValue(flag) {
    const idx = args.indexOf(flag);
    if (idx === -1) return undefined;
    const value = args[idx + 1];
    // Allow "-" as a conventional value (e.g., `--out -` means stdout).
    if (!value || (value.startsWith('-') && value !== '-')) {
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

  // Defaults can be set via env for convenience in shell scripts.
  // Flags always win.
  const maxTeaserRaw = takeFlagValue('--max-teaser') ?? process.env.F2A_MAX_TEASER;
  const maxTimestampsRaw = takeFlagValue('--max-timestamps') ?? process.env.F2A_MAX_TIMESTAMPS;

  function parseNonNegInt(name, v) {
    if (v == null) return undefined;

    // Treat empty env vars / accidental blanks as “unset” (avoid surprising behavior like "" → 0).
    const raw = String(v).trim();
    if (raw === '') return undefined;

    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
      process.stderr.write(`ERROR: ${name} must be a non-negative integer (got: ${v})\n`);
      usage(2);
    }
    return n;
  }

  const maxTeaser = parseNonNegInt('--max-teaser', maxTeaserRaw);
  const maxTimestamps = parseNonNegInt('--max-timestamps', maxTimestampsRaw);

  const cleanArgs = args.filter(
    (a) =>
      a !== '--copy' &&
      a !== '--copy-brief' &&
      a !== '--json' &&
      a !== '--no-note' &&
      a !== '--max-teaser' &&
      a !== '--max-timestamps'
  );

  function maybeWriteFile(text) {
    if (!outPath) return;

    // Common CLI convention: `--out -` means “stdout”.
    // We already print to stdout, so skip file I/O to avoid creating a file literally named "-".
    if (String(outPath).trim() === '-') return;

    const p = path.resolve(process.cwd(), String(outPath));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, String(text), 'utf8');
  }

  async function maybeCopy(text) {
    if (!copyToClipboard && !copyBriefOnly) return;

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

  function formatOutput({ source, title, brief }) {
    if (!outputJson) return String(brief);
    return JSON.stringify(
      {
        source: source || '',
        title: title || '',
        brief: String(brief),
      },
      null,
      2
    );
  }

  async function renderFromStdin() {
    const content = await readStdin();
    try {
      const extracted = extractFromStdin({ content, source: 'stdin' });
      const source = sourceOverride || extracted.source;
      const title = titleOverride || extracted.title;
      const brief = renderBrief({
        cmd,
        source,
        title,
        transcript: extracted.text,
        teaserMax: maxTeaser,
        timestampsMax: maxTimestamps,
      });
      const out = formatOutput({ source, title, brief });
      const copyText = copyBriefOnly || copyBriefWhenJson ? String(brief) : out;
      await maybeCopy(copyText);
      maybeWriteFile(out);
      process.stdout.write(`${out}\n`);
    } catch (e) {
      // UX nicety: if stdin is empty but the user explicitly provided Source/Title overrides,
      // allow generating a blank template rather than erroring.
      if (e && e.code === 2 && (sourceOverride || titleOverride)) {
        const source = sourceOverride;
        const title = titleOverride;
        const brief = renderBrief({
          cmd,
          source,
          title,
          transcript: '',
          teaserMax: maxTeaser,
          timestampsMax: maxTimestamps,
        });
        const out = formatOutput({ source, title, brief });
        const copyText = copyBriefOnly || copyBriefWhenJson ? String(brief) : out;
        await maybeCopy(copyText);
        maybeWriteFile(out);
        process.stdout.write(`${out}\n`);
        return;
      }

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

    // Strip common leading wrappers early so we can still recognize wrapped URLs like:
    //   (<https://...|label>)
    // Don't strip leading '[' when the string is a markdown link like: [label](url)
    if (!/^\[[^\]]*\]\(/.test(out)) {
      // Strip common quote prefixes from email/chat copy/paste (e.g., "> ").
      out = out.replace(/^>+\s*/g, '').trim();
      out = out.replace(/^[(`\{"'“”‘’«»‹›]+\s*/g, '').trim();
    }

    // Allow chat/markdown-friendly wrappers like:
    //   <https://...>
    // and Slack-style links like:
    //   <https://...|label>
    // Also tolerate trailing punctuation after the wrapper, e.g. "(<...>)".
    const slack = out.match(/^<\s*([^|>\s]+)\s*\|[^>]*>\s*[)\]>'\"`“”‘’»«›‹.,;:!?…。！，？。､、）】〉》」』]*$/i);
    if (slack) out = slack[1];

    const m = out.match(/^<\s*([^>\s]+)\s*>\s*[)\]>'\"`“”‘’»«›‹.,;:!?…。！，？。､、）】〉》」』]*$/i);
    if (m) out = m[1];

    // Markdown link wrapper (copy/paste from docs):
    //   [label](https://...)
    // Also tolerate trailing punctuation after the wrapper.
    const md = out.match(/^\s*\[[^\]]*\]\(\s*(https?:\/\/[^)\s]+)\s*\)\s*[)\]>'\"`“”‘’»«›‹.,;:!?…。！，？。､、）】〉》」』]*$/i);
    if (md) out = md[1];

    // Strip common trailing punctuation from copy/paste:
    //   https://...)
    //   https://...,;
    //   https://...!? (common in chat)
    // Also strip a few Unicode punctuation variants (…, fullwidth !/? and Chinese/Japanese punctuation).

    // Common copy/paste pattern: "https://... (Fathom)".
    // Only strip parenthetical suffixes when separated by whitespace to avoid mangling URLs
    // that legitimately contain parentheses.
    if (/^https?:\/\//i.test(out)) out = out.replace(/\s+\([^)]*\)\s*$/g, '');

    out = out.replace(/[)\]>'\"`“”‘’»«›‹.,;:!?…。！，？。､、）】〉》」』]+$/g, '');

    // Convenience: accept bare fathom.video URLs (no scheme) from chat copy/paste.
    // Example: fathom.video/share/<TOKEN>
    if (!/^https?:\/\//i.test(out)) {
      const bare = out.match(/^(?:www\.)?fathom\.video\/[\S]+/i);
      if (bare) out = `https://${bare[0]}`;
    }

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

  const out = formatOutput({
    source: sourceOverride || extracted.source,
    title: titleOverride || extracted.title,
    brief,
  });

  const copyText = copyBriefOnly || copyBriefWhenJson ? String(brief) : out;
  await maybeCopy(copyText);
  maybeWriteFile(out);
  process.stdout.write(`${out}\n`);
}

main().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
