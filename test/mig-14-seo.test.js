import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNextActions } from '../src/brief.js';

test('MIG-14: generateNextActions detects SEO issues', () => {
  const actions = generateNextActions('The SEO ranking dropped after the update.');
  assert(actions.includes('- [ ] Check SEO settings / meta tags'));
});

test('MIG-14: generateNextActions detects Meta Tag issues', () => {
  const actions = generateNextActions('The meta description tag is missing on the homepage.');
  assert(actions.includes('- [ ] Check SEO settings / meta tags'));
});

test('MIG-14: generateNextActions detects Robots.txt issues', () => {
  const actions = generateNextActions('Googlebot is blocked by robots.txt.');
  assert(actions.includes('- [ ] Check SEO settings / meta tags'));
});
