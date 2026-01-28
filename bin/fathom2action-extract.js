#!/usr/bin/env node
import process from 'node:process';
import { readStdin, extractFromStdin, extractFromUrl } from '../src/extractor.js';

function usage(code = 0) {
  console.log(`fathom2action-extract\n\nUsage:\n  fathom2action-extract <url> [--pretty]\n  fathom2action-extract --stdin [--source <url-or-label>] [--pretty]\n  fathom2action-extract - [--source <url-or-label>] [--pretty]\n\nOutput:\n  Prints JSON { ok, source, text, title, suggestedTitle, fetchError } to stdout.\n`);
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
  if (args.includes('-h') || args.includes('--help')) usage(0);

  const pretty = args.includes('--pretty');
  args = args.filter((a) => a !== '--pretty');

  const sourceFlag = readFlagValue(args, '--source');
  args = sourceFlag.args;
  const stdinSourceOverride = sourceFlag.value;

  // Convenience: if no args and stdin is piped, treat it like --stdin.
  if (!args.length) {
    if (!process.stdin.isTTY) {
      const content = await readStdin();
      const extracted = extractFromStdin({ content, source: stdinSourceOverride || 'stdin' });
      console.log(JSON.stringify(extracted, null, pretty ? 2 : 0));
      return;
    }
    usage(0);
  }

  if (args[0] === '--stdin' || args[0] === '-') {
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
  const extracted = await extractFromUrl(url);
  console.log(JSON.stringify(extracted, null, pretty ? 2 : 0));
}

main().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
