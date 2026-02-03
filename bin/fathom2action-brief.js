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
Usage: fathom2action [options] < extract.json
       fathom2action "https://..." (requires fetch/extract first, simpler to use fathom-extract | fathom2action)

Options:
  --cmd <name>          Command name to display in instructions (default: video-extract)
  --copy-brief          Copy output to clipboard (macOS only)
  --teaser <n>          Web teaser line count (default: 6)
  --timestamps <n>      Timestamp count (default: 6)
  --version             Show version info
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

const opts = {
  cmd: parseValue('--cmd') || 'video-extract',
  teaserMax: parseValue('--teaser'),
  timestampsMax: parseValue('--timestamps'),
  copy: args.includes('--copy-brief') || !!process.env.F2A_COPY,
};

async function main() {
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

       const brief = renderBrief({ url, ...opts });
       if (opts.copy) {
         try {
           await copyToClipboard(brief);
           console.error('Copied brief to clipboard.');
         } catch (e) {
           console.error(`Failed to copy: ${e.message}`);
           console.log(brief);
         }
       } else {
         console.log(brief);
       }
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

  if (opts.copy) {
    try {
      await copyToClipboard(brief);
      console.error('Copied brief to clipboard.');
    } catch (e) {
      console.error(`Failed to copy: ${e.message}`);
      console.log(brief);
    }
  } else {
    console.log(brief);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
