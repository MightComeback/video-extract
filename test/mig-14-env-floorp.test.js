import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('MIG-14: detects Floorp browser', () => {
  const transcript = `
    User reported an issue.
    They are using Floorp on Windows 11.
    The menu is broken.
  `;
  const output = renderBrief({ transcript });
  assert.match(output, /Browser \/ OS:.*Floorp/);
  assert.match(output, /Browser \/ OS:.*Windows 11/);
});

test('MIG-14: detects Waterfox browser', () => {
    const transcript = `
      User reported an issue.
      They are using Waterfox on macOS.
    `;
    const output = renderBrief({ transcript });
    assert.match(output, /Browser \/ OS:.*Waterfox/);
  });
