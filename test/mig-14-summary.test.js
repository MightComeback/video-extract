import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: renderBrief provides placeholder for missing description', (t) => {
  const output = renderBrief({});
  // Previously it might have been empty, now we want a placeholder
  assert.match(output, /## 1-sentence summary\n- \(add summary\)/);
});
