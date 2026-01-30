import { test } from 'node:test';
import assert from 'node:assert';
import { renderBrief } from '../src/brief.js';

test('Transcript teaser preserves data: URIs (does not treat "data" as speaker)', (t) => {
  const transcript = `
00:01 Alice: Here is an image
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=
00:02 Alice: Did you see it?
`.trim();

  const output = renderBrief({ transcript, teaserMax: 10 });
  // The data URI should appear in the teaser, potentially as a bullet point.
  // It MUST NOT have "data:" stripped.
  assert.ok(output.includes('data:image/png'), 'Output should contain the data URI prefix');
  // Check that it wasn't stripped to just "image/png..."
  // The output format puts "- " before each line.
  // So we look for "- data:image/png..."
  assert.ok(output.includes('- data:image/png'), 'The line should start with "- data:image"');
});
