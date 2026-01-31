import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects specific search vendors', async (t) => {
  await t.test('detects Elasticsearch', () => {
    const actions = generateNextActions('We are seeing issues with our Elasticsearch cluster.');
    assert(actions.includes('- [ ] Check search indexing / query logic'));
  });

  await t.test('detects Algolia', () => {
    const actions = generateNextActions('Algolia results are not syncing.');
    assert(actions.includes('- [ ] Check search indexing / query logic'));
  });

  await t.test('detects Meilisearch', () => {
    const actions = generateNextActions('Meilisearch container is down.');
    assert(actions.includes('- [ ] Check search indexing / query logic'));
  });

  await t.test('detects Solr', () => {
    const actions = generateNextActions('Solr query parsing error.');
    assert(actions.includes('- [ ] Check search indexing / query logic'));
  });

  await t.test('detects OpenSearch', () => {
    const actions = generateNextActions('OpenSearch dashboard is unreachable.');
    assert(actions.includes('- [ ] Check search indexing / query logic'));
  });
});
