import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSeverity, renderBrief } from '../src/brief.js';

test('extractSeverity detects Critical/Blocker keywords', () => {
  assert.equal(extractSeverity('The site is down!'), 'Critical / Blocker');
  assert.equal(extractSeverity('This is a p0 issue'), 'Critical / Blocker');
  assert.equal(extractSeverity('Major data loss occurred'), 'Critical / Blocker');
  assert.equal(extractSeverity('Blocking release'), 'Critical / Blocker');
});

test('extractSeverity detects High priority keywords', () => {
  assert.equal(extractSeverity('We need this ASAP'), 'High');
  assert.equal(extractSeverity('This is urgent'), 'High');
  assert.equal(extractSeverity('High priority fix'), 'High');
});

test('extractSeverity returns empty string for normal text', () => {
  assert.equal(extractSeverity('Just a minor bug'), '');
  assert.equal(extractSeverity('Hello world'), '');
});

test('renderBrief includes Severity field when high/critical', () => {
  const brief = renderBrief({
    transcript: 'The site is down right now!',
    source: 'https://fathom.video/share/123'
  });
  assert.match(brief, /## Environment \/ context/);
  assert.match(brief, /- Severity: Critical \/ Blocker/);
});

test('renderBrief omits Severity field when normal', () => {
  const brief = renderBrief({
    transcript: 'Hello, this is a test.',
    source: 'https://fathom.video/share/123'
  });
  assert.match(brief, /## Environment \/ context/);
  assert.doesNotMatch(brief, /- Severity:/);
});
