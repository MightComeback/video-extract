// CommonJS wrapper around the Linear helper.
// This exists so automation can `require('./scripts/linear.cjs')` even though
// the repo is ESM (`type: module`).
//
// Prefer the ESM entrypoint for human use:
//   node scripts/linear.js ...

module.exports = require('./linear-helper.cjs');
