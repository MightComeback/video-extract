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
