import { test } from 'node:test';
import assert from 'node:assert';
import './mig-14-env-librewolf.test.js'; // Self-import check? No.
import { renderBrief } from '../src/brief.js';

test('MIG-14: extractEnvironment detects LibreWolf browser', (t) => {
  const transcript = "The site doesn't load on LibreWolf.";
  const output = renderBrief({ transcript });
  assert.ok(output.includes('Browser / OS: LibreWolf'), 'Should detect LibreWolf');
});
