// Deterministic markdown brief generator


// MIG-14: extraction pipeline expected to be resilient to missing optional fields.
function oneLine(s) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeUrlLike(s) {
  let v0 = oneLine(s);
  if (!v0) return '';

  // Accept copy/paste-friendly prefixes (common in notes/envelopes):
  //   Source: https://...
  //   Link: <https://...>
  //   URL: https://...
  v0 = v0.replace(/^(?:source|link|url|fathom(?:\s*link)?|share(?:\s*link)?|recording|video(?:\s*link)?)\s*:\s*/i, '').trim();

  // Strip common leading wrappers from chat/markdown copy/paste early so we can still
  // recognize wrapped URLs like: ( <https://...|label> )
  // Examples:
  //   `https://...`
  //   (https://...)
  //   "https://..."
  //   [https://...]
  // Don't strip leading '[' when the string is a markdown link like: [label](url)
  if (!/^\[[^\]]*\]\(/.test(v0)) {
    // Also strip common quote prefixes from email/chat copy/paste (e.g., "> ").
    v0 = v0.replace(/^>+\s*/g, '').trim();
    v0 = v0.replace(/^[(`\{"'“”‘’«»‹›]+\s*/g, '').trim();
  }

  // Allow copy/paste-friendly forms like:
  //   <https://example.com>
  // and Slack-style links like:
  //   <https://example.com|label>
  // so we don't carry wrappers into the rendered markdown.
  // Also tolerate trailing chat punctuation after the wrapper, e.g. "(<...>)".
  const slack = v0.match(/^<\s*([^|>\s]+)\s*\|[^>]*>\s*[)\]>'\"`“”‘’»«›‹.,;:!?…。！，？。､、）】〉》」』}]*$/i);
  if (slack) {
    const u = String(slack[1] || '').trim();
    if (/^(?:https?:\/\/|data:)/i.test(u)) return u;
    const bare = u.match(/^(?:www\.)?fathom\.video\/[\S]+/i);
    if (bare) return `https://${bare[0]}`;
  }

  const angle = v0.match(/^<\s*([^>\s]+)\s*>\s*[)\]>'\"`“”‘’»«›‹.,;:!?…。！，？。､、）】〉》」』}]*$/i);
  if (angle) {
    const u = String(angle[1] || '').trim();
    if (/^(?:https?:\/\/|data:)/i.test(u)) return u;
    const bare = u.match(/^(?:www\.)?fathom\.video\/[\S]+/i);
    if (bare) return `https://${bare[0]}`;
  }

  // Accept markdown link form:
  //   [label](https://example.com)
  // Also accept bare fathom.video links without a scheme:
  //   [label](fathom.video/share/...) or [label](www.fathom.video/share/...)
  // Also tolerate trailing punctuation after the wrapper.
  const md = v0.match(
    /^\[[^\]]*\]\(\s*(?<u>(?:(?:https?:\/\/|data:)[^)\s]+)|(?:(?:www\.)?fathom\.video\/[^)\s]+))\s*\)\s*[)\]>'\"`“”‘’»«›‹.,;:!?…。！，？。､、）】〉》」』}]*$/i
  );
  if (md) {
    const u = String(md.groups?.u || '').trim();
    if (/^(?:https?:\/\/|data:)/i.test(u)) return u;
    const bare = u.match(/^(?:www\.)?fathom\.video\/[\S]+/i);
    if (bare) return `https://${bare[0]}`;
    return u;
  }

  // Strip common trailing punctuation from chat copy/paste (e.g. "https://...)").
  // Also strip "!" and "?" which frequently get appended in chat.
  // Include a few common Unicode punctuation variants (…, fullwidth !/? and Chinese/Japanese punctuation).
  // Include backticks for cases like: `https://example.com`
  if (/^(?:https?:\/\/|data:)/i.test(v0)) {
    // Common copy/paste pattern: "https://... (Fathom)".
    // Only strip parenthetical suffixes when separated by whitespace to avoid mangling URLs
    // that legitimately contain parentheses.
    if (!/^data:/i.test(v0)) {
      v0 = v0.replace(/\s+\([^)]*\)\s*$/g, '');
    }
    return v0.replace(/[)\]>'\"`“”‘’»«›‹.,;:!?…。！，？。､、）】〉》」』}]+$/g, '');
  }

  // Convenience: accept bare fathom.video URLs (no scheme) from chat copy/paste.
  const bare = v0.match(/^(?:www\.)?fathom\.video\/[\S]+/i);
  if (bare) {
    let u = `https://${bare[0]}`;
    u = u.replace(/\s+\([^)]*\)\s*$/g, '');
    return u.replace(/[)\]>'\"`“”‘’»«›‹.,;:!?…。！，？。､、）】〉》」』}]+$/g, '');
  }

  return v0;
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
      // Also strip common separators after the timestamp (":", "-", "–", "—", ".").
      /^(?:\[\s*|\(\s*)?(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\s*(?:\]|\))\s*)?(?:\s*[:\-–—\.]\s*)?\s*/,
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
  // Support non-ASCII speaker names (e.g., Cyrillic/accents) seen in real transcripts.
  // Keep it conservative to avoid eating real content.
  const speaker = /[\p{L}\p{N}][\p{L}\p{N} ._\-'’]{0,40}/u;

  // Optional role/metadata that often appears in exports:
  //  - Alice (Host): hello
  //  - Alice [Host]: hello
  // Keep it short to avoid eating real content.
  const role = String.raw`(?:\s*(?:\([^)]{1,30}\)|\[[^\]]{1,30}\]))?`;

  // Also handle fullwidth colon (common in some transcript exports / IMEs): "Alice： hello".
  return line
    .replace(new RegExp(`^${speaker.source}${role}[:：]\\s*(?!\\/\\/)`, 'u'), '')
    // Allow "Alice - hello", "Alice—hello", etc. Some exporters omit spaces around dash separators.
    .replace(new RegExp(`^${speaker.source}${role}\\s*[\\-–—]\\s*`, 'u'), '')
    .trim();
}

function normalizeBullets(lines, { max = 6 } = {}) {
  const limit = Number(max);
  if (!Number.isFinite(limit) || limit <= 0) return [];

  const out = [];
  const seen = new Set();

  for (const raw of String(lines || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    // Accept common bullet prefixes from transcripts / note exports.
    // Includes ASCII bullets (-, *) and common Unicode bullets/dashes (•, – , —).
    // Also accept some other Unicode bullets seen in notes: middle dot (·), black circle (●), small circle (◦),
    // small black square (▪) and triangular bullet (‣).
    const noBullet = line.replace(/^[-*•–—·●◦▪‣]\s*/, '');

    // Also accept numbered list prefixes commonly produced by note exports:
    //  - "1. ..."
    //  - "2) ..."
    // Also accept some common non-ASCII list separators used in localized note exports:
    //  - Fullwidth dot: 1． ... (U+FF0E)
    //  - Ideographic full stop: 1。 ... (U+3002)
    //  - Ideographic comma: 1、 ... (U+3001)
    //  - Fullwidth close paren: 1） ... (U+FF09)
    const noNumber = noBullet.replace(/^\d{1,3}(?:[.)]|[\uFF0E\u3002\u3001\uFF09])\s*/, '');
    const noTs = stripLeadingTimestamp(noNumber);
    const cleaned = stripLeadingSpeakerLabel(noTs);
    if (!cleaned) continue;

    // Avoid noisy repeats when transcript exporters duplicate lines.
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push(`- ${cleaned}`);
    if (out.length >= limit) break;
  }

  return out;
}

function extractTimestamps(transcript, { max = 6 } = {}) {
  const limit = Number(max);
  if (!Number.isFinite(limit) || limit <= 0) return [];

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
      if (out.length >= limit) return out;
    }
  }

  return out;
}

export function renderBrief({
  cmd = 'fathom2action',
  source,
  title,
  date,
  transcript,
  fetchError,
  teaserMax = 6,
  timestampsMax = 6,
} = {}) {
  const cmdName = oneLine(cmd) || 'fathom2action';
  const src = normalizeUrlLike(source);
  const t = oneLine(title);
  const d = oneLine(date);
  let teaserLimit = teaserMax == null ? 6 : Number(teaserMax);
  if (Number.isNaN(teaserLimit)) teaserLimit = 6;
  let timestampsLimit = timestampsMax == null ? 6 : Number(timestampsMax);
  if (Number.isNaN(timestampsLimit)) timestampsLimit = 6;

  const teaser = normalizeBullets(transcript, { max: Number.isFinite(teaserLimit) ? teaserLimit : 6 });
  const timestamps = extractTimestamps(transcript, { max: Number.isFinite(timestampsLimit) ? timestampsLimit : 6 });

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
    `- Example (X11): \`xclip -selection clipboard -o | ${cmdName} --stdin\``,
    `- Example (X11): \`xsel --clipboard --output | ${cmdName} --stdin\``,
    `- Example (Windows PowerShell): \`Get-Clipboard | ${cmdName} --stdin\``,
    `- Example (Windows cmd.exe): \`powershell -NoProfile -Command Get-Clipboard | ${cmdName} --stdin\``,
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
    '- Where (page/URL): ',
    '- Browser / OS: ',
    '- Build / SHA: ',
    `- When: ${d || ''}`,
    '',
    '## Attachments / evidence',
    '- Screenshot(s): ',
    '- Console/logs: ',
    '- Video: ',
    '',

    // Optional sections: allow callers to hide them entirely by passing 0.
    ...(timestampsLimit > 0
      ? ['## Timestamps', ...(timestamps.length ? timestamps.map((ts) => `- ${ts} — `) : ['- ']), '']
      : []),

    '## Next actions',
    '- [ ] ',
    '',

    ...(teaserLimit > 0
      ? [
          '## Transcript teaser (first lines)',
          ...(teaser.length ? teaser : [`- (paste transcript via \`${cmdName} --stdin\` for a better teaser)`]),
          '',
        ]
      : []),
  ].join('\n');
}
