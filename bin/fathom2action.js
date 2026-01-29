#!/usr/bin/env node
// Legacy wrapper kept only so existing scripts don't break.
// Prefer: `fathom2action` for bug-brief generation, or `fathom-extract` for
// transcript+media extraction.

// Historically some scripts may have invoked `node ./bin/fathom2action.js`.
// Route that to the brief generator to match the README's primary workflow.
import './fathom2action-brief.js';
