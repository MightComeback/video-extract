import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('renderBrief produces minimal markdown with empty input', () => {
  const output = renderBrief();
  assert.ok(output.includes('# Bug report brief'));
  assert.ok(output.includes('Source: (unknown)'));
});

test('renderBrief includes source and title', () => {
  const output = renderBrief({
    source: 'https://fathom.video/share/12345',
    title: 'My Meeting'
  });
  assert.ok(output.includes('Source: https://fathom.video/share/12345'));
  assert.ok(output.includes('Title: My Meeting'));
  assert.ok(output.includes('- Fathom: https://fathom.video/share/12345'));
});

test('renderBrief includes transcript teaser', () => {
  const transcript = `
00:01 Hello
00:02 World
00:03 Stick to the plan
  `;
  const output = renderBrief({ transcript });
  assert.ok(output.includes('## Transcript teaser'));
  assert.ok(output.includes('- Hello'));
  assert.ok(output.includes('- World'));
});

test('renderBrief respects timestamp limit', () => {
  const transcript = '00:01 t1\n00:02 t2';
  // If we pass timestampsMax: 0, it should hide the section
  const output = renderBrief({ transcript, timestampsMax: 0 });
  assert.ok(!output.includes('## Timestamps'));
});

test('renderBrief handles various bullet styles', () => {
  const transcript = `
    + Item 1
    * Item 2
    - Item 3
  `;
  const output = renderBrief({ transcript });
  assert.ok(output.includes('- Item 1'));
  assert.ok(output.includes('- Item 2'));
  assert.ok(output.includes('- Item 3'));
});

test('renderBrief uses description for 1-sentence summary', () => {
  const output = renderBrief({
    description: 'This is the summary.'
  });
  assert.ok(output.includes('## 1-sentence summary'));
  assert.ok(output.includes('- This is the summary.'));
});

test('renderBrief supports custom repro steps', () => {
  const output = renderBrief({
    reproSteps: ['Click button', 'Verify modal opens']
  });
  assert.ok(output.includes('1. Click button'));
  assert.ok(output.includes('2. Verify modal opens'));
});
