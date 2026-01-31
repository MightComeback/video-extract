import { test } from 'node:test';
import assert from 'node:assert';
import { generateNextActions } from '../src/brief.js';

test('heuristics: suggests checking browser console for explicit console mentions', () => {
  const t1 = "I saw a red error in the console when I clicked it.";
  const actions1 = generateNextActions(t1, []);
  assert.ok(actions1.some(a => a.includes('Check browser console logs')), 'Should suggest console logs for "console" mention');

  const t2 = "DevTools showed a weird object output.";
  const actions2 = generateNextActions(t2, []);
  assert.ok(actions2.some(a => a.includes('Check browser console logs')), 'Should suggest console logs for "DevTools" mention');
});
