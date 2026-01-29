// Minimal Linear helper for Hakky cron loops.
// Keep this tiny and dependency-free.
// Usage (example):
//   node -e "const h=require('./scripts/linear-helper.cjs'); h.getIssue('MIG-14').then(i=>console.log(i.state.type));"
//   node -e "const h=require('./scripts/linear-helper.cjs'); h.addComment('MIG-14','Shipped: ...');"

const { linearRequest } = require('../../hakky-tools/hakky/lib/linear');

async function getIssue(identifierOrId) {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error('LINEAR_API_KEY missing');

  const key = String(identifierOrId);
  const looksLikeIdentifier = /^[A-Z]+-\d+$/.test(key);

  // Linear's `issue(id: ...)` expects a UUID. For human identifiers like MIG-14,
  // query the issues collection with a filter.
  if (looksLikeIdentifier) {
    const [teamKey, numStr] = key.split('-');
    const number = Number(numStr);
    if (!teamKey || !Number.isFinite(number)) throw new Error(`Invalid issue identifier: ${key}`);

    const q = `query IssueByTeamAndNumber($teamKey: String!, $number: Float!) {
      issues(filter: { team: { key: { eq: $teamKey } }, number: { eq: $number } }, first: 1) {
        nodes {
          id
          identifier
          title
          url
          state { id name type }
        }
      }
    }`;

    const data = await linearRequest({ apiKey, query: q, variables: { teamKey, number } });
    const issue = data?.issues?.nodes?.[0];
    if (!issue) throw new Error(`Issue not found: ${key}`);
    return issue;
  }

  const q = `query Issue($id: String!) {
    issue(id: $id) {
      id
      identifier
      title
      url
      state { id name type }
    }
  }`;

  const data = await linearRequest({ apiKey, query: q, variables: { id: key } });
  if (!data?.issue) throw new Error(`Issue not found: ${key}`);
  return data.issue;
}

async function addComment(issueIdentifierOrId, body) {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error('LINEAR_API_KEY missing');

  // Allow passing either a UUID (Linear issue id) or a human identifier like MIG-14.
  const issue = await getIssue(issueIdentifierOrId);

  const q = `mutation IssueComment($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      success
      comment { id body url }
    }
  }`;

  const data = await linearRequest({
    apiKey,
    query: q,
    variables: { input: { issueId: String(issue.id), body: String(body) } },
  });

  if (!data?.commentCreate?.success) throw new Error('Failed to create Linear comment');
  return data.commentCreate.comment;
}

async function getIssueStateType(identifierOrId) {
  const issue = await getIssue(identifierOrId);
  return issue?.state?.type || '';
}

module.exports = {
  getIssue,
  getIssueStateType,
  addComment,
};
