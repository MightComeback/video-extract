import { strict as assert } from 'node:assert';
import { renderBrief } from '../src/brief.js';

const transcript = `
00:01 User: It crashes on my Nintendo Switch when I try to login.
00:02 Support: Which model?
00:03 User: The OLED model.
`;

const output = renderBrief({
  source: 'https://fathom.video/share/test',
  transcript,
});

// Heuristic: should detect "Nintendo Switch"
assert.match(output, /- Browser \/ OS:.*Nintendo Switch/i, 'Should detect Nintendo Switch in Environment');
