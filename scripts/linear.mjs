#!/usr/bin/env node
/**
 * Minimal Linear helper.
 *
 * Requires env:
 * - LINEAR_API_KEY
 *
 * Commands:
 *   node scripts/linear.mjs issue-state-type MIG-14
 *   node scripts/linear.mjs comment MIG-14 "text..."
 */

const API_URL = 'https://api.linear.app/graphql';

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const token = process.env.LINEAR_API_KEY;
if (!token) die('Missing env LINEAR_API_KEY');

const [cmd, issueKey, ...rest] = process.argv.slice(2);

function printHelp() {
  process.stdout.write(`Usage:
  node scripts/linear.mjs issue-state-type MIG-14
  node scripts/linear.mjs comment MIG-14 "text..."

Requires env:
  LINEAR_API_KEY
`);
}

if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
  printHelp();
  process.exit(0);
}

if (cmd !== 'issue-state-type' && cmd !== 'comment') die(`Unknown command: ${cmd}`);
if (!issueKey) die('Missing issue key (e.g. MIG-14)');

async function linearGraphQL(query, variables) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Linear HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Linear GraphQL error: ${json.errors.map(e => e.message).join('; ')}`);
  }
  return json.data;
}

async function getIssueByIdentifier(identifier) {
  const key = String(identifier);
  const looksLikeIdentifier = /^[A-Z]+-\d+$/.test(key);

  // For human identifiers like "MIG-14", query issues collection via team key + number.
  if (looksLikeIdentifier) {
    const [teamKey, numStr] = key.split('-');
    const number = Number(numStr);
    if (!teamKey || !Number.isFinite(number)) throw new Error(`Invalid issue identifier: ${key}`);

    const data = await linearGraphQL(
      `query IssueByTeamAndNumber($teamKey: String!, $number: Float!) {
        issues(filter: { team: { key: { eq: $teamKey } }, number: { eq: $number } }, first: 1) {
          nodes { id identifier title state { type name } }
        }
      }`,
      { teamKey, number }
    );

    const issue = data?.issues?.nodes?.[0];
    if (!issue) throw new Error(`Issue not found: ${key}`);
    return issue;
  }

  // Otherwise treat as a UUID.
  const data = await linearGraphQL(
    `query IssueById($id: String!) {
      issue(id: $id) { id identifier title state { type name } }
    }`,
    { id: key }
  );

  const issue = data?.issue;
  if (!issue) throw new Error(`Issue not found: ${key}`);
  return issue;
}

async function main() {
  if (cmd === 'issue-state-type') {
    const issue = await getIssueByIdentifier(issueKey);
    process.stdout.write(String(issue.state?.type ?? '') + '\n');
    return;
  }

  if (cmd === 'comment') {
    const body = rest.join(' ').trim();
    if (!body) die('Missing comment body');

    const issue = await getIssueByIdentifier(issueKey);

    await linearGraphQL(
      `mutation CommentCreate($input: CommentCreateInput!) {
        commentCreate(input: $input) { success }
      }`,
      { input: { issueId: issue.id, body } }
    );

    process.stdout.write('ok\n');
    return;
  }
}

main().catch(err => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
