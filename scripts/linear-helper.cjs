// Minimal Linear helper for Hakky cron loops.
// Keep this tiny and dependency-free.
// Usage (example):
//   node -e "(async()=>{const h=require('./scripts/linear-helper'); const issue=await h.getIssue('MIG-14'); console.log(issue.state.type);})()"

const { linearRequest } = require('../../hakky-tools/hakky/lib/linear');

async function getIssue(identifierOrId) {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) throw new Error('LINEAR_API_KEY missing');

  const q = `query Issue($id: String!) {
    issue(id: $id) {
      id
      identifier
      title
      url
      state { id name type }
    }
  }`;

  const data = await linearRequest({ apiKey, query: q, variables: { id: String(identifierOrId) } });
  if (!data?.issue) throw new Error(`Issue not found: ${identifierOrId}`);
  return data.issue;
}

module.exports = {
  getIssue,
};
