#!/usr/bin/env node
import process from 'node:process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { readStdin, extractFromStdin, extractFromUrl, getVersion } from '../src/extractor.js';
import { renderBrief, normalizeUrlLike } from '../src/brief.js';

function usage(code = 0) {
  const cmd = process.argv[1]?.split('/').pop() || 'fathom2action';
  console.log(`${cmd}

Usage:
  ${cmd} <fathom-share-url> [--copy] [--copy-brief] [--out <path>] [--json] [--compact-json] [--no-note] [--max-teaser <n>] [--max-timestamps <n>] [--cmd <name>]
  ${cmd} --stdin [--copy] [--copy-brief] [--out <path>] [--json] [--compact-json] [--source <url>] [--title <text>] [--max-teaser <n>] [--max-timestamps <n>] [--cmd <name>]
  ${cmd} - [--copy] [--copy-brief] [--out <path>] [--json] [--compact-json] [--source <url>] [--title <text>] [--max-teaser <n>] [--max-timestamps <n>] [--cmd <name>]
  ${cmd} --template [--copy] [--copy-brief] [--out <path>] [--json] [--compact-json] [--source <url>] [--title <text>] [--max-teaser <n>] [--max-timestamps <n>] [--cmd <name>]

Options:
  --copy                 Also copy to clipboard (best-effort; tries pbcopy, wl-copy, xclip, or xsel). If used with --json, copies the markdown brief.
  --copy-brief           Copy the markdown brief to clipboard (even if --json is used).
  --out <path>           Also write the generated output to a file.
  --json                 Output a JSON object with { source, title, brief } instead of markdown.
  --compact-json         When used with --json, output compact JSON (single line; useful for piping).
  --source <url>         Override the Source field (useful when piping transcript via --stdin).
  --title <text>         Override the Title field (useful when piping transcript via --stdin).
  --template             Generate a blank brief template (no URL fetch / no stdin required).
  --no-note              Suppress the "NOTE: Unable to fetch..." hint printed to stderr when a link can't be fetched.
  --max-teaser <n>       Max number of transcript teaser bullets to render (default: 6; use 0 to hide).
  --max-timestamps <n>   Max number of timestamps to render (default: 6; use 0 to hide).
  --cmd <name>           Override the command name shown in the "How to update this brief" section (useful when running via npx, bunx, etc.).
  --version              Print version and exit.

Env:
  F2A_MAX_TEASER         Default for --max-teaser (flags win).
  F2A_MAX_TIMESTAMPS     Default for --max-timestamps (flags win).
  F2A_COPY              If truthy (1/true/yes/on), behave as if --copy was passed.
  F2A_COPY_BRIEF        If truthy (1/true/yes/on), behave as if --copy-brief was passed.
  F2A_OUT               Default for --out (flags win).
  F2A_SOURCE            Default for --source (flags win).
  F2A_TITLE             Default for --title (flags win).
  F2A_CMD               Default for --cmd (flags win).
  F2A_NO_NOTE           If truthy (1/true/yes/on), behave as if --no-note was passed.

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
  const compactJson = args.includes('--compact-json');
  const templateMode = args.includes('--template');

  // UX: if the user asks to copy output while also requesting --json, it's almost always
  // more useful to copy the rendered markdown brief (the thing you paste into Linear/GitHub)
  // rather than the JSON wrapper.
  const copyBriefWhenJson = copyToClipboard && outputJson && !copyBriefOnly;
  const suppressNote = args.includes('--no-note') || truthyEnv('F2A_NO_NOTE');

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

  const sourceOverride = takeFlagValue('--source') ?? envOrUndefined('F2A_SOURCE');
  const titleOverride = takeFlagValue('--title') ?? envOrUndefined('F2A_TITLE');
  const cmdOverride = takeFlagValue('--cmd') ?? envOrUndefined('F2A_CMD');
  const cmdName = String(cmdOverride || cmd).trim() || cmd;

  function cleanSource(v) {
    if (v == null) return undefined;
    const raw = String(v).trim();
    if (!raw) return undefined;
    // Allow copy/paste wrappers like "Source: <https://...>" when users set --source explicitly.
    return normalizeUrlLike(raw) || raw;
  }

  function envOrUndefined(name) {
    const raw = String(process.env[name] || '').trim();
    return raw === '' ? undefined : raw;
  }

  const outPath = takeFlagValue('--out') ?? envOrUndefined('F2A_OUT');

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
      a !== '--compact-json' &&
      a !== '--template' &&
      a !== '--no-note' &&
      a !== '--max-teaser' &&
      a !== '--max-timestamps' &&
      a !== '--cmd'
  );

  function maybeWriteFile(text) {
    if (!outPath) return;

    // Common CLI convention: `--out -` means “stdout”.
    // We already print to stdout, so skip file I/O to avoid creating a file literally named "-".
    if (String(outPath).trim() === '-') return;

    // UX: allow `--out <dir>` (or `--out <dir>/`) and choose a sensible filename.
    // This avoids surprising EISDIR errors when users think of --out as an output location.
    // Also expand `~` to the current user's home directory for convenience.
    let outRaw = String(outPath);
    if (outRaw === '~') outRaw = os.homedir();
    if (/^~[\\/]/.test(outRaw)) outRaw = path.join(os.homedir(), outRaw.slice(2));

    let p = path.resolve(process.cwd(), outRaw);
    const looksLikeDir = /[\\/]$/.test(outRaw);

    const defaultFileName = outputJson ? 'bug-report-brief.json' : 'bug-report-brief.md';

    try {
      if (!looksLikeDir && fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        p = path.join(p, defaultFileName);
      } else if (looksLikeDir) {
        fs.mkdirSync(p, { recursive: true });
        p = path.join(p, defaultFileName);
      }
    } catch {
      // ignore; we'll fall back to treating p as a file path
    }

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

    const payload = {
      source: source || '',
      title: title || '',
      brief: String(brief),
    };

    // Default: pretty JSON for readability when copy/pasting into issues.
    // Compact mode: convenient for piping to jq or other CLI tooling.
    return compactJson ? JSON.stringify(payload) : JSON.stringify(payload, null, 2);
  }

  async function renderFromStdin() {
    const content = await readStdin();
    try {
      const extracted = extractFromStdin({ content, source: 'stdin' });
      const source = cleanSource(sourceOverride) || cleanSource(extracted.source) || extracted.source;
      const title = titleOverride || extracted.title;
      const brief = renderBrief({
        cmd: cmdName,
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
        const source = cleanSource(sourceOverride);
        const title = titleOverride;
        const brief = renderBrief({
          cmd: cmdName,
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
          `ERROR: stdin is empty. Pipe/paste a transcript (or a URL + transcript) and try again. Example: \`pbpaste | ${cmdName} --stdin\`. If you just want a blank brief, use \`${cmdName} --template\`.\n`
        );
        process.exit(2);
      }
      throw e;
    }
  }

  if (templateMode) {
    const source = cleanSource(sourceOverride);
    const title = titleOverride;
    const brief = renderBrief({
      cmd: cmdName,
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
    return normalizeUrlLike(u);
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
    cmd: cmdName,
    source: cleanSource(sourceOverride) || cleanSource(extracted.source) || extracted.source,
    title: titleOverride || extracted.title,
    transcript: extracted.text,
    fetchError: extracted.fetchError,
    teaserMax: maxTeaser,
    timestampsMax: maxTimestamps,
  });

  // If we couldn't fetch anything useful, nudge toward --stdin.
  if (!extracted.ok && !suppressNote) {
    process.stderr.write(
      `NOTE: Unable to fetch this link (often auth-gated). Paste transcript via \`${cmdName} --stdin\` for best results. Example: \`pbpaste | ${cmdName} --stdin\`.\n`
    );
  }

  const out = formatOutput({
    source: cleanSource(sourceOverride) || cleanSource(extracted.source) || extracted.source,
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
