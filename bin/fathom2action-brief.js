#!/usr/bin/env node

import { renderBrief, normalizeUrlLike } from '../src/brief.js';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

async function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    if (process.platform === 'darwin') {
      const child = spawn('pbcopy');
      child.stdin.write(text);
      child.stdin.end();
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pbcopy exited with code ${code}`));
      });
      child.on('error', reject);
    } else {
      reject(new Error('Clipboard copy only supported on macOS for now'));
    }
  });
}

async function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    // When invoked via execFile/spawn without piping, stdin is often a pipe that
    // never ends, which would otherwise hang forever. We treat "no data within a
    // short grace period" as empty stdin.
    let data = '';
    let resolved = false;

    const onData = (c) => {
      data += c;
      // If we got any data, wait for end.
      clearTimeout(timer);
    };

    const onEnd = () => {
      clearTimeout(timer);
      done(data);
    };

    const done = (v) => {
      if (resolved) return;
      resolved = true;

      // Cleanup so the process can exit promptly when stdin is a never-ending pipe.
      try {
        process.stdin.off('data', onData);
        process.stdin.off('end', onEnd);
        process.stdin.pause();
      } catch {
        // ignore
      }

      resolve(v);
    };

    const timer = setTimeout(() => {
      if (!data) done('');
    }, 25);

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
  });
}

const args = process.argv.slice(2);
const help = args.includes('--help') || args.includes('-h');
const version = args.includes('--version') || args.includes('-v');

if (version) {
  try {
    const pkgUrl = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(pkgUrl, 'utf8'));
    console.log(pkg.version);
  } catch (e) {
    console.error('unknown');
  }
  process.exit(0);
}

if (help) {
  console.log(`
Usage: video-brief [options] < extract.json
       video-brief "https://..." (requires fetch/extract first, simpler to use fathom-extract | video-brief)

Options:
  --cmd <name>          Command name to display in instructions (default: video-extract)
  --copy-brief          Copy output to clipboard (macOS only)
  --teaser <n>          Web teaser line count (default: 6)
  --timestamps <n>      Timestamp count (default: 6)
  --json                Output JSON {source,title,brief} instead of markdown
  --compact-json        Single-line JSON (useful with --json)
  --out <path>          Write output to file (use "-" for stdout)
  --template            Generate a blank brief template (no fetch required)
  --version             Show version info

Environment:
  F2A_COPY              Set to 1 to enable --copy-brief by default
  F2A_MAX_TEASER        Default max teaser lines (overridden by --teaser)
  F2A_MAX_TIMESTAMPS    Default max timestamps (overridden by --timestamps)
  F2A_COMPACT_JSON      Set to 1 for compact JSON by default
  F2A_OUT               Default output path (overridden by --out)
`);
  process.exit(0);
}

function parseValue(key) {
  const idx = args.indexOf(key);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return null;
}

function parseMaxEnv(val) {
  // Treat empty/whitespace-only string as unset (return null)
  if (val == null) return null;
  const trimmed = String(val).trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : n;
}

const opts = {
  cmd: parseValue('--cmd') || 'video-extract',
  teaserMax: parseValue('--teaser') != null ? parseMaxEnv(parseValue('--teaser')) : parseMaxEnv(process.env.F2A_MAX_TEASER),
  timestampsMax: parseValue('--timestamps') != null ? parseMaxEnv(parseValue('--timestamps')) : parseMaxEnv(process.env.F2A_MAX_TIMESTAMPS),
  copy: args.includes('--copy-brief') || !!process.env.F2A_COPY,
  json: args.includes('--json'),
  compactJson: args.includes('--compact-json') || !!process.env.F2A_COMPACT_JSON,
  out: parseValue('--out') || process.env.F2A_OUT || null,
  template: args.includes('--template'),
  source: parseValue('--source') || null,
  title: parseValue('--title') || null,
};

async function outputResult(briefMarkdown, data, opts) {
  // Build JSON payload if requested
  const payload = opts.json ? {
    source: data.source || data.url || data.mediaUrl || '',
    title: data.title || data.suggestedTitle || '',
    brief: briefMarkdown,
  } : null;

  const output = opts.json
    ? (opts.compactJson ? JSON.stringify(payload) : JSON.stringify(payload, null, 2))
    : briefMarkdown;

  // Handle clipboard copy (only copies the brief, not JSON wrapper)
  if (opts.copy) {
    try {
      await copyToClipboard(briefMarkdown);
      console.error('Copied brief to clipboard.');
    } catch (e) {
      console.error(`Failed to copy: ${e.message}`);
    }
  }

  // Handle file output
  if (opts.out && opts.out !== '-') {
    const outPath = opts.out;
    // Check if outPath is a directory
    let isDir = false;
    try {
      const stats = fs.statSync(outPath);
      isDir = stats.isDirectory();
    } catch {
      // Path doesn't exist, treat as file
    }

    const finalPath = isDir
      ? path.join(outPath, opts.json ? 'bug-report-brief.json' : 'bug-report-brief.md')
      : outPath;

    // Expand ~ to home directory
    const expandedPath = finalPath.startsWith('~')
      ? path.join(os.homedir(), finalPath.slice(1))
      : finalPath;

    fs.writeFileSync(expandedPath, output, 'utf8');
    console.error(`Wrote output to ${expandedPath}`);
    return;
  }

  // Default: stdout
  console.log(output);
}

import path from 'node:path';
import os from 'node:os';

async function main() {
  // Handle --template mode (no input required)
  if (opts.template) {
    const stubData = { source: opts.source || '', url: opts.source || '', title: opts.title || '' };
    const stubBrief = renderBrief({
      cmd: opts.cmd,
      ...stubData,
      teaserMax: opts.teaserMax,
      timestampsMax: opts.timestampsMax,
    });
    await outputResult(stubBrief, stubData, opts);
    return;
  }

  const input = await readStdin();
  if (!input.trim()) {
    // If user passed a URL as arg 1, maybe they want us to just print a stub?
    // But this tool primarily consumes JSON/Text.
    // Let's check for positional args.
    const pos = args.filter(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--cmd' && args[args.indexOf(a) - 1] !== '--teaser' && args[args.indexOf(a) - 1] !== '--timestamps');
    if (pos.length > 0) {
       // Just a URL passed? We can't fetch here. We rely on extractor.
       // But we can generate a stub brief.
       const url = normalizeUrlLike(pos[0]);

       if (!process.env.F2A_NO_NOTE) {
         console.error('NOTE: Unable to fetch this link (CLI only generates briefs from JSON/text stdin). To fetch content, pipe from `fathom-extract`.');
       }

       const urlData = { source: url, url, title: '' };
       const brief = renderBrief({ ...urlData, ...opts });
       await outputResult(brief, urlData, opts);
       return;
    }
    console.error('Error: no input provided via stdin.');
    process.exit(1);
  }

  // Try parsing JSON
  let data = {};
  try {
    const json = JSON.parse(input);
    if (json && typeof json === 'object') {
      data = json;
    } else {
      data = { transcript: input };
    }
  } catch {
    // Treat as plain text transcript
    data = { transcript: input };
  }

  // Map JSON fields to renderBrief args
  const brief = renderBrief({
    cmd: opts.cmd,
    source: data.source || data.mediaUrl || data.url,
    url: data.source || data.mediaUrl || data.url,
    title: data.title || data.suggestedTitle,
    date: data.date,
    description: data.description,
    author: data.author,
    transcript: data.text || data.transcript,
    reproSteps: data.reproSteps, // optional in JSON
    fetchError: data.fetchError,
    screenshot: data.screenshot,
    teaserMax: opts.teaserMax,
    timestampsMax: opts.timestampsMax,
  });

  await outputResult(brief, data, opts);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
