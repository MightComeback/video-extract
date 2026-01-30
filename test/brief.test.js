import { test } from 'node:test';
import assert from 'node:assert';
import { extractPaths, renderBrief } from '../src/brief.js';

test('extractPaths finds URL paths in transcript', (t) => {
  const transcript = `
    I was looking at /dashboard/settings and it was broken.
    Also checked /api/v1/users.
    However, 1/2 is not a path.
    Neither is / alone.
    We saw this on /users/123/profile.
  `;
  const paths = extractPaths(transcript);
  assert.deepStrictEqual(paths.sort(), [
    '/api/v1/users',
    '/dashboard/settings',
    '/users/123/profile'
  ].sort());
});

test('renderBrief handles missing optional fields', (t) => {
  const brief = renderBrief({
    transcript: 'Some transcript',
    cmd: 'f2a'
  });
  
  assert.match(brief, /Source: \(unknown\)/);
  assert.match(brief, /Title: \(unknown\)/);
  assert.match(brief, /When: \(unknown\)/);
  assert.match(brief, /Who: \(unknown\)/);
});

test('renderBrief includes extracted paths', (t) => {
  const brief = renderBrief({
    transcript: 'I saw a bug on /pricing page',
  });
  assert.match(brief, /- Where \(page\/URL\): \/pricing/);
});
