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

function extractTimestamps(transcript, { max = 6 } = {}) {
  const out = [];
  const seen = new Set();

  // Common patterns:
  //  - 00:12
  //  - 1:02
  //  - 00:01:23
  //  - [00:12] or (00:12)
  const re = /(?:^|\s|\[|\()(?<ts>(?:\d{1,2}:)?\d{1,2}:\d{2}|\d{1,2}:\d{2})(?:\b|\]|\))/g;

  for (const raw of String(transcript || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    let m;
    while ((m = re.exec(line))) {
      const ts = String(m.groups?.ts || '').trim();
      if (!ts) continue;
      if (seen.has(ts)) continue;
      seen.add(ts);
      out.push(ts);
      if (out.length >= max) return out;
    }
  }

  return out;
}

export function renderBrief({ source, title, transcript, fetchError } = {}) {
  const src = oneLine(source);
  const t = oneLine(title);
  const teaser = normalizeBullets(transcript, { max: 6 });
  const timestamps = extractTimestamps(transcript, { max: 6 });

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
    ...(timestamps.length ? timestamps.map((ts) => `- ${ts} — `) : ['- ']),
    '',
    '## Next actions',
    '- [ ] ',
    '',
    '## Transcript teaser (first lines)',
    ...(teaser.length ? teaser : ['- (paste transcript via `fathom2action --stdin` for a better teaser)']),
    '',
  ].join('\n');
}
