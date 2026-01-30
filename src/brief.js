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

  // Strip common quote prefixes from email/chat copy/paste (e.g., "> ") early.
  // We do this before checking for "Source:" prefixes so that "> Source: ..." is handled correctly.
  v0 = v0.replace(/^>+\s*/g, '').trim();

  // Accept copy/paste-friendly prefixes (common in notes/envelopes):
  //   Source: https://...
  //   Link: <https://...>
  //   URL: https://...
  v0 = v0.replace(/^(?:source|fathom(?:\s*link)?|share(?:\s*link)?|link|url|recording|video(?:\s*link)?|meeting|call|(?:google\s*meet|meet)(?:\s*link)?|(?:(?:microsoft|ms)\s*)?teams(?:\s*link)?|zoom(?:\s*link)?|webex(?:\s*link)?|loom(?:\s*link)?|(?:slack\s*)?huddle)\s*[:=\-–—]\s*/i, '').trim();

  // Strip common leading wrappers from chat/markdown copy/paste early so we can still
  // recognize wrapped URLs like: ( <https://...|label> )
  // Examples:
  //   `https://...`
  //   (https://...)
  //   "https://..."
  //   [https://...]
  // Don't strip leading '[' when the string is a markdown link like: [label](url)
  if (!/^\[[^\]]*\]\(/.test(v0)) {
    // Strip other common leading wrappers (parentheses, quotes, etc.).
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

const SPEAKER_NAME_PATTERN = /[\p{L}\p{N}][\p{L}\p{N} ._\-'’]{0,40}/u.source;
const SPEAKER_ROLE_PATTERN = String.raw`(?:\s*(?:\([^)]{1,30}\)|\[[^\]]{1,30}\]))?`;

function stripLeadingSpeakerLabel(s) {
  const line = String(s || '').trim();
  if (!line) return '';

  // Avoid stripping URLs like "http://...".
  if (/^https?:\/\//i.test(line)) return line;
  if (/^data:/i.test(line)) return line;

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
  const speaker = SPEAKER_NAME_PATTERN;

  // Optional role/metadata that often appears in exports:
  //  - Alice (Host): hello
  //  - Alice [Host]: hello
  // Keep it short to avoid eating real content.
  const role = SPEAKER_ROLE_PATTERN;

  // Also handle fullwidth colon (common in some transcript exports / IMEs): "Alice： hello".
  return line
    .replace(new RegExp(`^${speaker}${role}[:：]\\s*(?!\\/\\/)`, 'u'), '')
    // Allow "Alice - hello", "Alice—hello", etc. Some exporters omit spaces around dash separators.
    .replace(new RegExp(`^${speaker}${role}\\s*[\\-–—]\\s*`, 'u'), '')
    .trim();
}

function extractSpeakers(transcript) {
  const out = new Set();
  const reColon = new RegExp(`^(${SPEAKER_NAME_PATTERN}${SPEAKER_ROLE_PATTERN})[:：]\\s*(?!\\/\\/)`, 'u');
  const reDash = new RegExp(`^(${SPEAKER_NAME_PATTERN}${SPEAKER_ROLE_PATTERN})\\s*[\\-–—]\\s*`, 'u');

  for (const raw of String(transcript || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^https?:\/\//i.test(line)) continue;

    let m = reColon.exec(line);
    if (!m) m = reDash.exec(line);

    if (m) {
      out.add(m[1].trim());
    }
  }
  return [...out];
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
    const noBullet = line.replace(/^[-*+•–—·●◦▪‣]\s*/, '');

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

export function extractTimestamps(transcript, { max = 6 } = {}) {
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

function extractEnvironment(transcript) {
  const s = String(transcript || '').toLowerCase();
  const hits = [];

  const browsers = ['chrome', 'firefox', 'safari', 'edge', 'brave', 'arc', 'opera', 'vivaldi', 'chromium', 'duckduckgo', 'samsung internet', 'orion'];
  const os = ['mac', 'macos', 'windows', 'ubuntu', 'fedora', 'debian', 'linux', 'android', 'ios', 'iphone', 'ipad'];
  const devices = ['pixel', 'galaxy', 'xiaomi', 'oneplus', 'redmi', 'huawei'];
  const environments = ['staging', 'production', 'prod', 'localhost'];

  for (const b of browsers) {
    if (new RegExp(`\\b${b}\\b`, 'i').test(s)) {
      if (b === 'duckduckgo') hits.push('DuckDuckGo');
      else if (b === 'samsung internet') hits.push('Samsung Internet');
      else hits.push(b.charAt(0).toUpperCase() + b.slice(1));
    }
  }
  for (const o of os) {
    if (new RegExp(`\\b${o}\\b`, 'i').test(s)) {
      // Normalize macos -> macOS, ios -> iOS
      if (o === 'macos') hits.push('macOS');
      else if (o === 'ios' || o === 'iphone' || o === 'ipad') hits.push('iOS');
      else hits.push(o.charAt(0).toUpperCase() + o.slice(1));
    }
  }
  for (const d of devices) {
    if (new RegExp(`\\b${d}\\b`, 'i').test(s)) {
      hits.push(d.charAt(0).toUpperCase() + d.slice(1));
    }
  }
  for (const e of environments) {
    if (new RegExp(`\\b${e}\\b`, 'i').test(s)) {
      if (e === 'prod') hits.push('Production');
      else hits.push(e.charAt(0).toUpperCase() + e.slice(1));
    }
  }

  // Dedupe keys like Mac vs macOS
  const unique = [...new Set(hits)];
  if (unique.includes('Mac') && unique.includes('macOS')) {
    unique.splice(unique.indexOf('Mac'), 1);
  }

  return unique.join(', ');
}

function extractBugHints(transcript) {
  const expected = [];
  const actual = [];

  // Simple sentence splitting (approximate).
  // Clean up newlines to process flowing text.
  const clean = String(transcript || '').replace(/\r?\n/g, ' ');
  const sentences = clean.split(/(?<=[.!?])\s+/);

  for (const raw of sentences) {
    const s = raw.trim();
    if (s.length < 10 || s.length > 200) continue;
    const lower = s.toLowerCase();

    // Heuristics for "Expected"
    if (
      lower.includes('expect') ||
      lower.includes('should be') ||
      lower.includes('should have') ||
      lower.includes('supposed to') ||
      lower.includes('goal was')
    ) {
      // Avoid questions? Maybe. For now, keep it simple.
      expected.push(s);
    }

    // Heuristics for "Actual"
    if (
      lower.includes('actual') ||
      lower.includes('instead') ||
      lower.includes('current behavior') ||
      lower.includes('happened') ||
      lower.includes('got an error') ||
      lower.includes('error occurred') ||
      lower.includes('result was') ||
      lower.includes('output was') ||
      lower.includes('nothing happened') ||
      lower.includes('fails') ||
      lower.includes('crashes') ||
      lower.includes('freeze') ||
      lower.includes('hang') ||
      lower.includes('stuck') ||
      lower.includes('blank screen') ||
      lower.includes('white screen') ||
      lower.includes('spinning') ||
      lower.includes('infinite loop')
    ) {
      actual.push(s);
    }
  }

  // Dedupe
  return {
    expected: [...new Set(expected)].slice(0, 3),
    actual: [...new Set(actual)].slice(0, 3),
  };
}

export function generateNextActions(transcript, actualHints = []) {
  const actions = new Set();
  const lowerT = String(transcript || '').toLowerCase();
  
  // Base action
  actions.add('Reproduce locally');

  // Crash / Error analysis
  if (
    actualHints.some(h => /crash|error|exception|stack|trace|bad gateway|internal server error|status code 5|HTTP 5\d{2}/i.test(h)) ||
    /crash|error|exception|stack|trace|bad gateway|internal server error|status code 5|HTTP 5\d{2}|502|503|504/i.test(lowerT)
  ) {
    actions.add('Check server logs / Sentry');
  }

  // Performance
  if (
    actualHints.some(h => /slow|lag|timeout|latency|loading/i.test(h)) ||
    /slow|lag|timeout|latency|loading/i.test(lowerT)
  ) {
    actions.add('Check network traces');
  }

  // Auth / Permissions
  if (
    actualHints.some(h => /401|403|permission|access|denied|forbidden|login|sign in|auth/i.test(h)) ||
    /401|403|permission|access|denied|forbidden|login|sign in|auth/i.test(lowerT)
  ) {
    actions.add('Check permissions / user roles');
  }

  // Regression
  if (
    /regression|used to work|worked before|worked yesterday|broken since|last update|stopped working/i.test(lowerT)
  ) {
    actions.add('Check recent changes');
  }

  // Broken links / 404
  if (
    actualHints.some(h => /404|not found|page missing/i.test(h)) ||
    /404|not found|page missing|page does not exist/i.test(lowerT)
  ) {
    actions.add('Check broken links / routing');
  }

  // UI / Visual
  if (
    actualHints.some(h => /layout|css|style|align|overlap|cut off|responsive|broken ui|misaligned/i.test(h)) ||
    /layout|css|style|align|overlap|cut off|responsive|broken ui|misaligned/i.test(lowerT)
  ) {
    actions.add('Check responsive styles / CSS');
  }

  // If mobile mentioned
  if (/ios|android|mobile|iphone|ipad/i.test(lowerT)) {
    actions.add('Test on physical device / simulator');
  }

  // Database / Data
  if (
    /database|sql|postgres|mongo|migration|seed|corrupt data|data integrity/i.test(lowerT)
  ) {
    actions.add('Check database state / migrations');
  }

  // Cache / Cookies
  if (
    /cache|cookies|clear storage|local storage|session storage|stale data/i.test(lowerT)
  ) {
    actions.add('Clear cache / cookies');
  }

  // API / Validation
  if (
    actualHints.some(h => /400|bad request|validation|invalid param|invalid input/i.test(h)) ||
    /400|bad request|validation|invalid param|invalid input/i.test(lowerT)
  ) {
    actions.add('Check API payloads / Validation');
  }

  // API Rates / CORS
  if (
    actualHints.some(h => /cors|access-control-allow-origin|cross-origin|blocked by cors/i.test(h)) ||
    /cors|access-control-allow-origin|cross-origin|blocked by cors/i.test(lowerT)
  ) {
    actions.add('Check CORS configuration');
  }
  if (
    actualHints.some(h => /429|too many requests|rate limit|quota exceeded/i.test(h)) ||
    /429|too many requests|rate limit|quota exceeded/i.test(lowerT)
  ) {
    actions.add('Check rate limits');
  }

  return [...actions].map(a => `- [ ] ${a}`);
}

export function extractPaths(transcript) {
  const out = new Set();
  const raw = String(transcript || '');
  // Heuristic: identify strings starting with / that look like URL paths.
  // Must start with / and have at least 2 chars.
  // Must be preceded by whitespace or start of string.
  // Use lookahead for trailing boundary to avoid consuming the separator
  // (which might be the leading separator for the NEXT match).
  const tokens = raw.split(/\s+/);
  
  for (const t of tokens) {
    if (/^https?:\/\//.test(t)) {
      try {
        const u = new URL(t);
        if (u.pathname && u.pathname !== '/') out.add(u.pathname);
      } catch (e) {
        // ignore
      }
      continue;
    }

    if (!t.startsWith('/')) continue;
    
    // Clean trailing punctuation including ) ] } which regex missed
    const clean = t.replace(/[.,;:!?\)\]\}]+$/, '');

    // Heuristic: must look like a path
    // - start with / (checked)
    // - contain only valid path chars (alphanumeric, -, _, ., /)
    // - length >= 2 (avoid isolated /)
    // - contain at least one letter (avoid 1/2, dates, etc.)
    if (/^\/[\w\-\.\/]+$/.test(clean) && clean.length >= 2 && /[a-zA-Z]/.test(clean)) {
      out.add(clean);
    }
  }
  return [...out];
}

export function renderBrief({
  cmd = 'fathom2action',
  source,
  url,
  title,
  date,
  description,
  author,
  transcript,
  fetchError,
  teaserMax = 6,
  timestampsMax = 6,
} = {}) {
  const cmdName = oneLine(cmd) || 'fathom2action';
  const src = normalizeUrlLike(source || url);
  const t = oneLine(title);
  const d = oneLine(date);
  const auth = oneLine(author);
  const desc = oneLine(description);
  let teaserLimit = teaserMax == null ? 6 : Number(teaserMax);
  if (Number.isNaN(teaserLimit)) teaserLimit = 6;
  let timestampsLimit = timestampsMax == null ? 6 : Number(timestampsMax);
  if (Number.isNaN(timestampsLimit)) timestampsLimit = 6;

  const teaser = normalizeBullets(transcript, { max: Number.isFinite(teaserLimit) ? teaserLimit : 6 });
  const timestamps = extractTimestamps(transcript, { max: Number.isFinite(timestampsLimit) ? timestampsLimit : 6 });
  const envLikely = extractEnvironment(transcript);
  const speakers = extractSpeakers(transcript);
  const paths = extractPaths(transcript);
  const hints = extractBugHints(transcript);
  const nextActions = generateNextActions(transcript, hints.actual);

  const header = [
    '# Bug report brief',
    '',
    `Source: ${src || '(unknown)'}`,
    `Title: ${t || '(unknown)'}`,
    `Suggested issue title: ${t || '(unknown)'}`,
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
    `- ${desc || '(add summary)'}`,
    '',
    '## Repro steps',
    '1. ',
    '2. ',
    '3. ',
    '',
    '## Expected vs actual',
    `- Expected: ${hints.expected.length ? hints.expected.join(' / ') : ''}`,
    `- Actual: ${hints.actual.length ? hints.actual.join(' / ') : ''}`,
    '',
    '## Environment / context',
    `- Who: ${speakers.length ? speakers.join(', ') : (auth || '(unknown)')}`,
    `- Where (page/URL): ${paths.length ? paths.join(', ') : ''}`,
    `- Browser / OS: ${envLikely || '(unknown)'}`,
    '- Build / SHA: ',
    `- When: ${d || '(unknown)'}`,
    '',
    '## Attachments / evidence',
    '- Screenshot(s): ',
    '- Console/logs: ',
    `- Video: ${src || ''}`,
    '',

    // Optional sections: allow callers to hide them entirely by passing 0.
    ...(timestampsLimit > 0
      ? ['## Timestamps', ...(timestamps.length ? timestamps.map((ts) => `- ${ts} — `) : ['- ']), '']
      : []),

    '## Next actions',
    ...(nextActions.length ? nextActions : ['- [ ] ']),
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
