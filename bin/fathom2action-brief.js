#!/usr/bin/env node
import process from 'node:process';
import { spawn } from 'node:child_process';

import { readStdin, extractFromStdin, extractFromUrl, getVersion } from '../src/extractor.js';
import { renderBrief } from '../src/brief.js';

function usage(code = 0) {
  const cmd = process.argv[1]?.split('/').pop() || 'fathom2action';
  console.log(`${cmd}

Usage:
  ${cmd} <fathom-share-url> [--copy]
  ${cmd} --stdin [--copy]
  ${cmd} - [--copy]

Options:
  --copy    Also copy the generated brief to clipboard (best-effort; uses pbcopy when available).

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
  const cleanArgs = args.filter((a) => a !== '--copy');

  async function maybeCopy(text) {
    if (!copyToClipboard) return;

    // Best-effort clipboard copy (Mac). If pbcopy isn't available, we just warn.
    await new Promise((resolve) => {
      const child = spawn('pbcopy');
      child.on('error', (err) => {
        if (err?.code === 'ENOENT') {
          process.stderr.write('NOTE: --copy requested but pbcopy is not available on this system.\n');
          return resolve();
        }
        process.stderr.write(`NOTE: --copy failed: ${String(err?.message || err)}\n`);
        resolve();
      });
      child.on('close', () => resolve());
      try {
        child.stdin.write(String(text));
        child.stdin.end();
      } catch {
        resolve();
      }
    });
  }

  async function renderFromStdin() {
    const content = await readStdin();
    try {
      const extracted = extractFromStdin({ content, source: 'stdin' });
      const out = renderBrief({
        source: extracted.source,
        title: extracted.title,
        transcript: extracted.text,
      });
      await maybeCopy(out);
      process.stdout.write(out);
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

  const url = cleanArgs[0];
  const extracted = await extractFromUrl(url, {
    // Keep this lightweight: we only need the transcript for a brief.
    downloadMedia: false,
    splitSeconds: 0,
  });

  const brief = renderBrief({
    source: extracted.source,
    title: extracted.title,
    transcript: extracted.text,
    fetchError: extracted.fetchError,
  });

  // If we couldn't fetch anything useful, nudge toward --stdin.
  if (!extracted.ok) {
    process.stderr.write(
      `NOTE: Unable to fetch this link (often auth-gated). Paste transcript via \`${cmd} --stdin\` for best results. Example: \`pbpaste | ${cmd} --stdin\`.\n`
    );
  }

  await maybeCopy(brief);
  process.stdout.write(brief);
}

main().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
