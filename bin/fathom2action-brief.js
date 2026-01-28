#!/usr/bin/env node
import process from 'node:process';

import { readStdin, extractFromStdin, extractFromUrl } from '../src/extractor.js';
import { renderBrief } from '../src/brief.js';

function usage(code = 0) {
  const cmd = process.argv[1]?.split('/').pop() || 'fathom2action';
  console.log(`${cmd}

Usage:
  ${cmd} <fathom-share-url>
  ${cmd} --stdin
  ${cmd} -

Notes:
  - If the URL cannot be fetched (auth-gated), the tool will print a ready-to-paste brief and ask for transcript via --stdin.
`);
  process.exit(code);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) usage(0);

  // Convenience: no args + piped stdin.
  if (!args.length && !process.stdin.isTTY) {
    const content = await readStdin();
    const extracted = extractFromStdin({ content, source: 'stdin' });
    process.stdout.write(
      renderBrief({
        source: extracted.source,
        title: extracted.title,
        transcript: extracted.text,
      })
    );
    return;
  }

  if (!args.length) usage(0);

  if (args[0] === '--stdin' || args[0] === '-') {
    const content = await readStdin();
    const extracted = extractFromStdin({ content, source: 'stdin' });
    process.stdout.write(
      renderBrief({
        source: extracted.source,
        title: extracted.title,
        transcript: extracted.text,
      })
    );
    return;
  }

  const url = args[0];
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
    process.stderr.write('NOTE: Unable to fetch this link. Paste transcript via `fathom2action --stdin` for best results.\n');
  }

  process.stdout.write(brief);
}

main().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
