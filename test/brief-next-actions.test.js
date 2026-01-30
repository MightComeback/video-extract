import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('renderBrief suggests checking logs for crashes', (t) => {
  const brief = renderBrief({
    transcript: "The app crashes when I click the button. I got an error on the screen."
  });
  assert.match(brief, /- \[ \] Check server logs \/ Sentry/);
});

test('renderBrief suggests checking network for slow/timeout issues', (t) => {
  const brief = renderBrief({
    transcript: "It is very slow and eventually times out."
  });
  assert.match(brief, /- \[ \] Check network traces/);
});

test('renderBrief suggests checking permissions for auth issues', (t) => {
  const brief = renderBrief({
    transcript: "I got a 403 error when trying to save."
  });
  assert.match(brief, /- \[ \] Check permissions \/ user roles/);
});

test('renderBrief suggests checking database for migration issues', (t) => {
  const brief = renderBrief({
    transcript: "Since the last migration, the user data is corrupt."
  });
  assert.match(brief, /- \[ \] Check database state \/ migrations/);
});

test('renderBrief always suggests reproducing locally', (t) => {
  const brief = renderBrief({ transcript: "Something happened." });
  assert.match(brief, /- \[ \] Reproduce locally/);
});

test('renderBrief suggests testing on device/simulator for mobile issues', (t) => {
  const brief = renderBrief({
    transcript: "The layout is broken on iOS Safari."
  });
  assert.match(brief, /- \[ \] Test on physical device \/ simulator/);
});
