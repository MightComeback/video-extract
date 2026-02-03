import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects specific search vendors - Elasticsearch', () => {
  const actions = generateNextActions('Elasticsearch index is failing');
  assert.ok(actions.some((a) => a.includes('Check search indexing / query logic')));
});

test('MIG-14: generateNextActions detects specific search vendors - Algolia', () => {
  const actions = generateNextActions('Algolia search results are empty');
  assert.ok(actions.some((a) => a.includes('Check search indexing / query logic')));
});

test('MIG-14: generateNextActions detects specific search vendors - Meilisearch', () => {
  const actions = generateNextActions('Meilisearch query timed out');
  assert.ok(actions.some((a) => a.includes('Check search indexing / query logic')));
});
