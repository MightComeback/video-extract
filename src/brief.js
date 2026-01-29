// Deterministic markdown brief generator

function oneLine(s) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrlLike(s) {
  const v = oneLine(s);
  // Allow copy/paste-friendly forms like:
  //   <https://example.com>
  // so we don't carry angle brackets into the rendered markdown.
  if (/^<https?:\/\/.+>$/.test(v)) return v.slice(1, -1);
  return v;
}

function stripLeadingTimestamp(s) {
  // Only strip when it appears at the start of the line.
  // Examples:
  //  - 00:12 Hello
  //  - 1:02:03 Something
  //  - [00:12] Hello
  //  - (00:12) Hello
  return String(s || '')
    .replace(
      // Also strip common separators after the timestamp (":", "-", "–", "—").
      /^(?:\[\s*|\(\s*)?(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\s*(?:\]|\))\s*)?(?:\s*[:\-–—]\s*)?\s*/,
      ''
    )
    .trim();
}

function stripLeadingSpeakerLabel(s) {
  const line = String(s || '').trim();
  if (!line) return '';

  // Avoid stripping URLs like "http://...".
  if (/^https?:\/\//i.test(line)) return line;

  // Common transcript forms:
  //  - Alice: hello
  //  - Ivan K.: hello
  //  - QA-1: hello
  //  - Alice - hello
  //  - Alice — hello
  // Keep this conservative to avoid deleting meaningful prefixes.
  // Allow a bit of punctuation that appears in names (., ', -, underscores).
  const speaker = /[A-Za-z0-9][A-Za-z0-9 ._\-'’]{0,40}/;

  // Optional role/metadata that often appears in exports:
  //  - Alice (Host): hello
  //  - Alice [Host]: hello
  // Keep it short to avoid eating real content.
  const role = String.raw`(?:\s*(?:\([^)]{1,30}\)|\[[^\]]{1,30}\]))?`;

  return line
    .replace(new RegExp(`^${speaker.source}${role}:\\s+(?!\\/\\/)`), '')
    .replace(new RegExp(`^${speaker.source}${role}\\s*[\\-–—]\\s+`), '')
    .trim();
}

function normalizeBullets(lines, { max = 6 } = {}) {
  const out = [];
  const seen = new Set();

  for (const raw of String(lines || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    // Accept common bullet prefixes from transcripts / note exports.
    // Includes ASCII bullets (-, *) and the Unicode bullet (•).
    const noBullet = line.replace(/^[-*•]\s*/, '');

    // Also accept numbered list prefixes commonly produced by note exports:
    //  - "1. ..."
    //  - "2) ..."
    const noNumber = noBullet.replace(/^\d{1,3}[.)]\s*/, '');
    const noTs = stripLeadingTimestamp(noNumber);
    const cleaned = stripLeadingSpeakerLabel(noTs);
    if (!cleaned) continue;

    // Avoid noisy repeats when transcript exporters duplicate lines.
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push(`- ${cleaned}`);
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
  const re = /(?:^|\s|\[|\()(?<ts>(?:\d{1,2}:)?\d{1,2}:\d{2})(?:\b|\]|\))/g;

  for (const raw of String(transcript || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    // Reset between lines: global regexes keep lastIndex, which can skip matches
    // at the start of the next line.
    re.lastIndex = 0;

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

export function renderBrief({
  cmd = 'fathom2action',
  source,
  title,
  transcript,
  fetchError,
  teaserMax = 6,
  timestampsMax = 6,
} = {}) {
  const cmdName = oneLine(cmd) || 'fathom2action';
  const src = normalizeUrlLike(source);
  const t = oneLine(title);
  const teaser = normalizeBullets(transcript, { max: Number(teaserMax) || 6 });
  const timestamps = extractTimestamps(transcript, { max: Number(timestampsMax) || 6 });

  const header = [
    '# Bug report brief',
    '',
    `Source: ${src || '(unknown)'}`,
    `Title: ${t || '(unknown)'}`,
  ];

  if (fetchError) {
    header.push(`Fetch error: ${oneLine(fetchError)}`);
  }

  const links = ['## Links'];
  if (src) {
    links.push(`- Fathom: ${src}`);
  } else {
    links.push('- (add Fathom link)');
  }

  const howToUpdate = [
    '## How to update this brief',
    `- If you can access the Fathom link: re-run \`${cmdName} "<link>"\``,
    `- If the link is auth-gated: copy the transcript and pipe it into \`${cmdName} --stdin\``,
    `- Example (macOS): \`pbpaste | ${cmdName} --stdin\``,
    `- Example (Wayland): \`wl-paste | ${cmdName} --stdin\``,
    `- Example (Windows PowerShell): \`Get-Clipboard | ${cmdName} --stdin\``,
  ];

  return [
    ...header,
    '',
    ...links,
    '',
    ...howToUpdate,
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
