#!/usr/bin/env node
import process from 'node:process';
import { readStdin } from '../src/extractor.js';
import { mkBrief } from '../src/transformer.js';

function maybeWarnDeprecatedAlias() {
  const cmd = process.argv[1]?.split('/').pop() || '';
  if (/^fathom2action-?transform/i.test(cmd)) {
    console.error(`WARN: '${cmd}' is deprecated. Prefer 'fathom-transform' (same behavior).`);
  }
}

function usage(code = 0) {
  const cmd = process.argv[1]?.split('/').pop() || 'fathom-transform';
  console.log(`${cmd}\n\nUsage:\n  ${cmd} --json         # reads extractor JSON from stdin\n  ${cmd} --stdin        # reads raw transcript/notes from stdin\n\nOptions:\n  --source <url-or-label>   Only for --stdin mode (raw text).\n\nOutput:\n  Prints a markdown bug brief to stdout.\n`);
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
  maybeWarnDeprecatedAlias();

  let args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) usage(0);

  const sourceFlag = readFlagValue(args, '--source');
  args = sourceFlag.args;
  const stdinSourceOverride = sourceFlag.value;

  const isJson = args.includes('--json');
  const isStdin = args.includes('--stdin') || args.includes('-');

  if (!isJson && !isStdin) usage(2);

  const content = await readStdin();

  if (isJson) {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('ERR: failed to parse JSON from stdin');
      process.exit(2);
    }
    const source = parsed.source || 'stdin';
    const text = parsed.text || '';
    const suggestedTitle = parsed.suggestedTitle || '';
    const title = parsed.title || '';
    const fetchError = parsed.fetchError || null;
    const mediaUrl = parsed.mediaUrl || '';

    console.log(mkBrief({ source, content: text, mediaUrl, suggestedTitle, title, fetchError }));
    return;
  }

  // Raw text stdin
  const text = String(content || '').trim();
  if (!text) {
    console.error('ERR: stdin is empty');
    process.exit(2);
  }

  if (!stdinSourceOverride) {
    console.log(mkBrief({ source: 'stdin', content: text }));
    return;
  }

  console.log(mkBrief({ source: stdinSourceOverride, content: text }));
}

main().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
