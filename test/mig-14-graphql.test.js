import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects GraphQL issues', (t) => {
  const cases = [
    {
      input: 'We got a graphql error when running the mutation.',
      expected: 'Check GraphQL schema / operations'
    },
    {
      input: 'The query failed with syntax error in the gql request.',
      expected: 'Check GraphQL schema / operations'
    },
    {
      input: 'Variable $id of type ID! was provided invalid value',
      expected: 'Check GraphQL schema / operations'
    }
  ];

  for (const c of cases) {
    const actions = generateNextActions(c.input);
    const found = actions.some(a => a.includes(c.expected));
    assert.equal(found, true, `Should detect "${c.expected}" in "${c.input}"`);
  }
});
