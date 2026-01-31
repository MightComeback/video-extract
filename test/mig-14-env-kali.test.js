import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('extracts Kali Linux from transcript', (t) => {
  const transcript = `
00:01 Alice: I am running on Kali Linux and the exploit is not working.
  `;
  const brief = renderBrief({ transcript });
  assert.match(brief, /- Browser \/ OS: .*Kali/);
});
