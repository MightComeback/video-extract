import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('renderBrief: uses (unknown) placeholder for missing optional fields', () => {
  const brief = renderBrief({
    source: 'https://example.com',
    title: 'Test',
    // Date and env missing
  });

  // Should contain When: (unknown) instead of When: _blank_
  assert.ok(brief.includes('- When: (unknown)'), 'Missing date should be marked (unknown)');
  
  // Should contain Browser / OS: (unknown) instead of Browser / OS: _blank_
  assert.ok(brief.includes('- Browser / OS: (unknown)'), 'Missing environment should be marked (unknown)');
});
