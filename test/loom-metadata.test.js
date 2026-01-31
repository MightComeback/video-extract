import { test } from 'node:test';
import assert from 'node:assert';
import { fetchLoomOembed } from '../src/loom.js';

// Mock global fetch if needed, but for now we might rely on network or mock it.
// Since this is a CI/Cron environment, external network calls might be flaky or blocked?
// "Web search" tool is available, but exec network access depends on the host.
// The user prompt setup says: "setup: set -a; source .secrets/linear.env"
// It seems network is allowed (Linear API check worked).
// But for unit tests, better to mock.

test('fetchLoomOembed returns null for invalid URL', async () => {
  const data = await fetchLoomOembed('');
  assert.strictEqual(data, null);
});

// We can't easily mock fetch without a library or overriding global.fetch.
// I'll skip the network test for now and just verify the function exists and handles empty input.
// If I override global.fetch it might affect other things if parallel, but this is a standalone test file run.

test('fetchLoomOembed handles 404 cleanly', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => global.fetch = originalFetch);

  global.fetch = async () => ({ ok: false });
  
  const data = await fetchLoomOembed('https://www.loom.com/share/bad-id');
  assert.strictEqual(data, null);
});

test('fetchLoomOembed parses JSON on 200', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => global.fetch = originalFetch);

  global.fetch = async () => ({
    ok: true,
    json: async () => ({ title: 'My Video', author_name: 'Might' })
  });

  const data = await fetchLoomOembed('https://www.loom.com/share/good-id');
  assert.deepStrictEqual(data, { title: 'My Video', author_name: 'Might' });
});
