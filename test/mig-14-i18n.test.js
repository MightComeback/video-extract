
import { test } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: detect internalization / i18n issues', (t) => {
  const cases = [
    {
      transcript: "The button says 'translation_missing' when I click it.",
      match: /Check translations \/ i18n keys/
    },
    {
      transcript: "It shows the key 'auth.login.failed' instead of the text.",
      match: /Check translations \/ i18n keys/
    },
    {
      transcript: "The language is set to French but the header is still English.",
      match: /Check translations \/ i18n keys/
    },
    {
      transcript: "I see {{name}} instead of the user name.",
      match: /Check variable interpolation/
    },
  ];

  for (const c of cases) {
    const actions = generateNextActions(c.transcript);
    const found = actions.some(a => c.match.test(a));
    assert.strictEqual(found, true, `Should suggest checking i18n for: "${c.transcript}"`);
  }
});
