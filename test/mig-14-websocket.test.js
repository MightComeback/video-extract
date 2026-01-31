import assert from 'node:assert';
import { test } from 'node:test';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: Suggests checking Websockets for realtime issues', () => {
  const t1 = `
    The chat isn't updating.
    I see a websocket error in the console.
    It says connection failed.
  `;
  const a1 = generateNextActions(t1, ['websocket error']);
  assert.ok(a1.some(a => a.includes('Check Websocket')), 'Should suggest checking Websockets');

  const t2 = `
    wss://api.example.com/socket failed to connect.
    Realtime updates are broken.
  `;
  const a2 = generateNextActions(t2, []);
  assert.ok(a2.some(a => a.includes('Check Websocket')), 'Should suggest checking Websockets for wss://');
});
