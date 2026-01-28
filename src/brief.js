// Deterministic markdown brief generator

function oneLine(s) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBullets(lines, { max = 6 } = {}) {
  const out = [];
  for (const raw of String(lines || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    out.push(`- ${line.replace(/^[-*]\s+/, '')}`);
    if (out.length >= max) break;
  }
  return out;
}

export function renderBrief({ source, title, transcript, fetchError } = {}) {
  const src = oneLine(source);
  const t = oneLine(title);
  const teaser = normalizeBullets(transcript, { max: 6 });

  const header = [
    '# Bug report brief',
    '',
    `Source: ${src || '(unknown)'}`,
    `Title: ${t || '(unknown)'}`,
  ];

  if (fetchError) {
    header.push(`Fetch error: ${oneLine(fetchError)}`);
  }

  return [
    ...header,
    '',
    '## 1-sentence summary',
    '- ',
    '',
    '## Repro steps',
    '1. ',
    '2. ',
    '3. ',
    '',
    '## Expected vs actual',
    '- Expected: ',
    '- Actual: ',
    '',
    '## Environment / context',
    '- Who: ',
    '- Where: ',
    '- When: ',
    '',
    '## Timestamps',
    '- ',
    '',
    '## Next actions',
    '- [ ] ',
    '',
    '## Transcript teaser (first lines)',
    ...(teaser.length ? teaser : ['- (paste transcript via `fathom2action --stdin` for a better teaser)']),
    '',
  ].join('\n');
}
