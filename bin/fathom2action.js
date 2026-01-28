#!/usr/bin/env node
import process from 'node:process';
import { readStdin, getVersion, extractFromStdin, extractFromUrl } from '../src/extractor.js';
import { mkBrief } from '../src/transformer.js';

function usage(code = 0) {
  console.log(`fathom2action\n\nUsage:\n  fathom2action <fathom-url>\n  fathom2action --stdin [--source <url-or-label>]\n  fathom2action -          # read stdin\n  fathom2action --version\n\nTip:\n  If you run without args and stdin is piped, it will automatically read stdin.\n\nOutput:\n  Prints a markdown bug brief template filled with extracted context (best effort).\n\nNotes:\n  MVP intentionally works even without API keys: if we can't fetch/parse the link, pipe transcript/notes via --stdin.\n`);
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

async function main() {
  let args = process.argv.slice(2);

  const sourceFlag = readFlagValue(args, '--source');
  args = sourceFlag.args;
  const stdinSourceOverride = sourceFlag.value;

  if (args.includes('-h') || args.includes('--help')) usage(0);
  if (args.includes('-v') || args.includes('--version')) {
    console.log(getVersion());
    return;
  }

  // Convenience: if no args and stdin is piped, treat it like --stdin.
  if (!args.length) {
    if (!process.stdin.isTTY) {
      const content = await readStdin();
      try {
        const extracted = extractFromStdin({ content, source: stdinSourceOverride || 'stdin' });
        console.log(
          mkBrief({
            source: extracted.source,
            content: extracted.text,
            mediaUrl: extracted.mediaUrl,
            suggestedTitle: extracted.suggestedTitle,
            title: extracted.title
          })
        );
        return;
      } catch (e) {
        if (e?.code === 2) {
          console.error('ERR: stdin is empty');
          process.exit(2);
        }
        throw e;
      }
    }
    usage(0);
  }

  if (args[0] === '--stdin' || args[0] === '-') {
    const content = await readStdin();
    try {
      const extracted = extractFromStdin({ content, source: stdinSourceOverride || 'stdin' });
      console.log(
        mkBrief({
          source: extracted.source,
          content: extracted.text,
          mediaUrl: extracted.mediaUrl,
          suggestedTitle: extracted.suggestedTitle,
          title: extracted.title
        })
      );
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

  // Best-effort fetch: public links may work; private/authenticated ones won't.
  const extracted = await extractFromUrl(url);
  console.log(
    mkBrief({
      source: extracted.source,
      content: extracted.text,
      mediaUrl: extracted.mediaUrl,
      fetchError: extracted.fetchError,
      suggestedTitle: extracted.suggestedTitle,
      title: extracted.title
    })
  );
}

main().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
