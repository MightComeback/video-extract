// ESM wrapper for the cron loop.
// Provides a stable import path (`./scripts/linear.js`) while keeping the
// implementation in a tiny CommonJS helper.
//
// Example:
//   import('./scripts/linear.js').then(async m => {
//     const issue = await m.getIssue('MIG-14');
//     console.log(issue.state.type);
//   });

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const h = require('./linear-helper.cjs');

export const getIssue = h.getIssue;
export const getIssueStateType = h.getIssueStateType;
export const addComment = h.addComment;

export default {
  getIssue,
  getIssueStateType,
  addComment,
};

// --- CLI (for cron / quick use) ---
// Commands:
//   node scripts/linear.js issue-state-type MIG-14
//   node scripts/linear.js comment MIG-14 "text..."
function printHelp() {
  process.stdout.write(`Usage:
  node scripts/linear.js issue-state-type <ISSUE_KEY>
  node scripts/linear.js comment <ISSUE_KEY> "text..."

Requires env:
  LINEAR_API_KEY
`);
}

async function cliMain() {
  const [cmd, issueKey, ...rest] = process.argv.slice(2);

  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    printHelp();
    process.exit(0);
  }

  if (cmd !== 'issue-state-type' && cmd !== 'comment') {
    process.stderr.write(`Unknown command: ${cmd}\n`);
    printHelp();
    process.exit(1);
  }

  if (!issueKey) {
    process.stderr.write('Missing issue key (e.g. MIG-14)\n');
    process.exit(1);
  }

  if (cmd === 'issue-state-type') {
    const t = await getIssueStateType(issueKey);
    process.stdout.write(String(t ?? ''));
    return;
  }

  if (cmd === 'comment') {
    const body = rest.join(' ').trim();
    if (!body) {
      process.stderr.write('Missing comment body\n');
      process.exit(1);
    }
    await addComment(issueKey, body);
    process.stdout.write('ok');
  }
}

// Run CLI only when executed directly.
// (argv[1] can be relative; compare resolved paths)
const isDirect =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirect) cliMain().catch((e) => {
  process.stderr.write(String(e?.stack || e) + '\n');
  process.exit(1);
});
