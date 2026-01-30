import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('renderBrief suggests clearing cache for cache/cookie issues', () => {
  const brief = renderBrief({
    transcript: 'I think it is a cache issue. Maybe we need to clear cookies.',
    teaserMax: 0,
    timestampsMax: 0,
  });

  assert.match(brief, /- \[ \] Clear cache \/ cookies/);
});

test('renderBrief suggests clearing cache for local storage mention', () => {
  const brief = renderBrief({
    transcript: 'The local storage seems empty, maybe stale data.',
    teaserMax: 0,
    timestampsMax: 0,
  });
  
  assert.match(brief, /- \[ \] Clear cache \/ cookies/);
});
