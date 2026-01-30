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

test('renderBrief always suggests reproducing locally', (t) => {
  const brief = renderBrief({ transcript: "Something happened." });
  assert.match(brief, /- \[ \] Reproduce locally/);
});
