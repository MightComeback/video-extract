import { test } from 'node:test';
import assert from 'node:assert';
import { extractPaths } from '../src/brief.js';

test('MIG-14: extractPaths includes hostname for root URLs', (t) => {
  const transcript = "I went to https://staging.myapp.com/ and it crashed.";
  const paths = extractPaths(transcript);
  
  // Currently, it ignores pathname === '/', so this returns nothing.
  // We want it to return 'staging.myapp.com' or the full URL.
  // Let's decide on behavior: if path is /, return hostname.
  
  assert.ok(paths.some(p => p.includes('staging.myapp.com')), `Expected paths to include staging.myapp.com, got ${JSON.stringify(paths)}`);
});
