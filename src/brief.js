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
  v0 = v0.replace(/^(?:source|fathom(?:\s*(?:link|recording|share|video))?|share(?:\s*link)?|link|url|recording|video(?:\s*link)?|meeting|call|(?:google\s*meet|meet)(?:\s*link)?|(?:(?:microsoft|ms)\s*)?teams(?:\s*link)?|zoom(?:\s*link)?|webex(?:\s*link)?|loom(?:\s*link)?|(?:slack\s*)?huddle)\s*[:=\-–—]\s*/i, '').trim();

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
    const stripped = v0.replace(/[)\]>'\"`“”‘’»«›‹.,;:!?…。！，？。､、）】〉》」』}]+$/g, '');
    if (v0.endsWith(')') && stripped.length < v0.length) {
      const openCount = (stripped.match(/\(/g) || []).length;
      const closeCount = (stripped.match(/\)/g) || []).length;
      if (openCount > closeCount) {
        const diff = v0.slice(stripped.length);
        if (diff.startsWith(')')) {
          return stripped + ')';
        }
      }
    }
    return stripped;
  }

  // Convenience: accept bare fathom.video URLs (no scheme) from chat copy/paste.
  const bare = v0.match(/^(?:www\.)?fathom\.video\/[\S]+/i);
  if (bare) {
    let u = `https://${bare[0]}`;
    u = u.replace(/\s+\([^)]*\)\s*$/g, '');
    
    const stripped = u.replace(/[)\]>'\"`“”‘’»«›‹.,;:!?…。！，？。､、）】〉》」』}]+$/g, '');
    if (u.endsWith(')') && stripped.length < u.length) {
      const openCount = (stripped.match(/\(/g) || []).length;
      const closeCount = (stripped.match(/\)/g) || []).length;
      if (openCount > closeCount) {
        const diff = u.slice(stripped.length);
        if (diff.startsWith(')')) {
          return stripped + ')';
        }
      }
    }
    return stripped;
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

export function extractSeverity(transcript) {
  const s = String(transcript || '').toLowerCase();

  // Critical / Blocker
  if (
    /production down|site is down|service is down|outage|sev ?1|p0|blocker|blocking release|data loss|critical|fatal/i.test(
      s
    )
  ) {
    return 'Critical / Blocker';
  }

  // High
  if (/urgent|asap|high priority|important|deadline|sev[- ]?2|p1/i.test(s)) {
    return 'High';
  }

  // Medium
  if (/medium priority|normal priority|sev[- ]?3|p2|moderate/i.test(s)) {
    return 'Medium';
  }

  // Low
  if (/low priority|minor|trivial|cosmetic|sev[- ]?4|p3/i.test(s)) {
    return 'Low';
  }

  return '';
}

function extractEnvironment(transcript) {
  const s = String(transcript || '').toLowerCase();
  const hits = [];

  const browsers = ['chrome', 'firefox', 'safari', 'edge', 'brave', 'arc', 'opera', 'vivaldi', 'chromium', 'duckduckgo', 'samsung internet', 'orion', 'tor browser', 'zen', 'librewolf', 'ladybird', 'floorp', 'waterfox'];
  const os = ['mac', 'macos', 'sequoia', 'sonoma', 'ventura', 'monterey', 'big sur', 'catalina', 'mojave', 'high sierra', 'sierra', 'el capitan', 'yosemite', 'mavericks', 'windows 11', 'windows 10', 'windows 8.1', 'windows 8', 'windows 7', 'windows', 'ubuntu', 'fedora', 'debian', 'centos', 'mint', 'rhel', 'arch linux', 'nixos', 'alpine', 'manjaro', 'gentoo', 'opensuse', 'linux', 'android', 'ios', 'iphone', 'ipad', 'chromeos', 'chromebook', 'cros', 'visionos', 'vision pro', 'oculus', 'quest', 'meta quest', 'playstation 5', 'playstation 4', 'playstation', 'ps5', 'ps4', 'xbox series x', 'xbox series s', 'xbox', 'steam deck', 'steamos'];
  const devices = ['pixel', 'galaxy', 'xiaomi', 'oneplus', 'redmi', 'huawei', 'surface', 'motorola', 'oppo', 'vivo', 'realme'];
  const environments = ['staging', 'production', 'prod', 'localhost'];

  for (const b of browsers) {
    if (new RegExp(`\\b${b}\\b`, 'i').test(s)) {
      if (b === 'duckduckgo') hits.push('DuckDuckGo');
      else if (b === 'samsung internet') hits.push('Samsung Internet');
      else if (b === 'librewolf') hits.push('LibreWolf');
      else hits.push(b.charAt(0).toUpperCase() + b.slice(1));
    }
  }
  for (const o of os) {
    if (new RegExp(`\\b${o.replace('.', '\\.')}\\b`, 'i').test(s)) {
      // Normalize macos -> macOS, ios -> iOS
      if (o === 'macos') hits.push('macOS');
      else if (o === 'ios' || o === 'iphone' || o === 'ipad') hits.push('iOS');
      else if (o === 'chromeos' || o === 'chromebook' || o === 'cros') hits.push('ChromeOS');
      else if (o === 'visionos' || o === 'vision pro') hits.push('visionOS');
      else if (o === 'oculus' || o === 'quest' || o === 'meta quest') hits.push('Meta Quest');
      else if (['playstation 5', 'ps5'].includes(o)) hits.push('PlayStation 5');
      else if (['playstation 4', 'ps4'].includes(o)) hits.push('PlayStation 4');
      else if (o === 'playstation') hits.push('PlayStation');
      else if (['xbox series x', 'xbox series s'].includes(o)) hits.push('Xbox Series X/S');
      else if (o === 'xbox') hits.push('Xbox');
      else if (o === 'steam deck' || o === 'steamos') hits.push('Steam Deck');
      else if(['sequoia', 'sonoma', 'ventura', 'monterey', 'big sur', 'catalina', 'mojave', 'high sierra', 'sierra', 'el capitan', 'yosemite', 'mavericks'].includes(o)) {
        if (o === 'high sierra') hits.push('macOS High Sierra');
        else if (o === 'el capitan') hits.push('macOS El Capitan');
        else if (o === 'big sur') hits.push('macOS Big Sur');
        else hits.push(`macOS ${o.charAt(0).toUpperCase() + o.slice(1)}`);
      }
      else if (o === 'centos') hits.push('CentOS');
      else if (o === 'rhel') hits.push('RHEL');
      else if (o === 'arch linux') hits.push('Arch Linux');
      else if (o === 'gentoo') hits.push('Gentoo');
      else if (o === 'opensuse') hits.push('openSUSE');
      else if (o === 'nixos') hits.push('NixOS');
      else if (o.startsWith('windows ')) {
        // Specific Windows version
        hits.push(o.charAt(0).toUpperCase() + o.slice(1));
      }
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
  // Dedupe generic macOS if specific version exists
  const hasSpecificMac = unique.some(k => /^macOS [A-Z]/.test(k));
  if (hasSpecificMac && unique.includes('macOS')) {
    unique.splice(unique.indexOf('macOS'), 1);
  }
  // Dedupe High Sierra vs Sierra
  if (unique.includes('macOS High Sierra') && unique.includes('macOS Sierra')) {
    unique.splice(unique.indexOf('macOS Sierra'), 1);
  }
  // Dedupe generic Windows if specific version exists
  const hasSpecificWin = unique.some(k => /^Windows \d/.test(k));
  if (hasSpecificWin && unique.includes('Windows')) {
    unique.splice(unique.indexOf('Windows'), 1);
  }
  // Dedupe Windows 8 if 8.1 is present
  if (unique.includes('Windows 8.1') && unique.includes('Windows 8')) {
    unique.splice(unique.indexOf('Windows 8'), 1);
  }

  return unique.join(', ');
}

function extractBuildNumber(transcript) {
  // Look for patterns like "v1.2.3", "Build 123", "Version 1.2"
  const s = String(transcript || '');

  // Look for Git SHA/commit
  const sha = s.match(/(?:sha|commit)\s*(?:[:#]\s*)?([0-9a-f]{7,40})\b/i);
  if (sha) return sha[1];

  // Relaxed version matching to include -rc.1, -beta, etc.
  const version = s.match(/(?:version|v)\s*(\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)/i);
  if (version) return version[1];

  const build = s.match(/build\s*(\d+)/i);
  if (build) return `Build ${build[1]}`;
  
  return '';
}

export function extractBugHints(transcript) {
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
      lower.includes('exception') ||
      lower.includes('stack trace') ||
      lower.includes('undefined') ||
      lower.includes('bad request') ||
      lower.includes('forbidden') ||
      lower.includes('unauthorized') ||
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
      lower.includes('glitch') ||
      lower.includes('flicker') ||
      lower.includes('infinite loop') ||
      lower.includes('broken') ||
      lower.includes('timed out') ||
      lower.includes('laggy')
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

export function extractStackTraces(transcript) {
  const s = String(transcript || '');
  const out = [];
  // Basic heuristic: Line starting with ErrorName: ... followed by indented 'at ...' lines.
  // We require at least one 'at ' line indentation.
  const re = /(?:^|\n)((?:[a-zA-Z0-9_$]+Error|[a-zA-Z0-9_$]+Exception|SyntaxError|TypeError|ReferenceError|RangeError|URIError|EvalError|AggregateError):[^\n]*\n(?:\s+at [^\n]+\n)+)/g;
  
  let m;
  while ((m = re.exec(s))) {
    out.push(m[1].trim());
  }
  return out;
}

export function extractReproSteps(transcript) {
  const out = [];
  const lines = String(transcript || '').split(/\r?\n/);
  
  // Heuristic: Look for explicit "Step 1", "Step 2" lines.
  // We require at least "Step 1" and "Step 2" to exist to consider it a valid list.
  const stepPattern = /^\s*step\s*(\d+)[:.-]?\s*(.+)$/i;
  
  const found = new Map(); // Num -> Text

  for (const line of lines) {
    const m = line.match(stepPattern);
    if (m) {
      const num = parseInt(m[1], 10);
      const text = m[2].trim();
      if (text.length > 2) { // Ignore "Step 1" (empty text)
        found.set(num, text);
      }
    }
  }

  // If we found a sequence starting at 1...
  if (found.has(1)) {
    let next = 1;
    while (found.has(next)) {
      out.push(found.get(next));
      next++;
    }
  }

  // Only return if we found at least 2 steps (avoid false positives on "Step 1 is check logs")
  // Or if we found Step 1 and it looks very like a repro step?
  // Let's rely on the sequence. "Step 1..." alone might be noise.
  // But if the user says "Step 1: Click it", that's a repro step.
  // Requirement: if found.size >= 1 ???
  // The test "ignores 'Step 1' if it does not look like a list" passed before because I asserted default output.
  // Now I need to ensure I don't break that.
  // The test had: "I think Step 1 is the most important..." -> regex `^\s*step\s*(\d+)` won't match mid-sentence.
  // So my regex `^\s*` handles the "start of line" constraint properly.
  
  return out;
}

export function generateNextActions(transcript, actualHints = []) {
  const actions = new Set();
  const lowerT = String(transcript || '').toLowerCase();
  
  // Base action
  actions.add('Reproduce locally');

  // Status Page
  if (
    actualHints.some(h => /status page|system status|outage page|incident/i.test(h)) ||
    /status page|system status|outage page|incident/i.test(lowerT)
  ) {
    actions.add('Check external status page');
  }

  // Crash / Error analysis
  if (
    actualHints.some(h => /crash|error|exception|stack|trace|bad gateway|internal server error|status code 5|HTTP 5\d{2}/i.test(h)) ||
    /crash|error|exception|stack|trace|bad gateway|internal server error|status code 5|HTTP 5\d{2}|502|503|504/i.test(lowerT)
  ) {
    actions.add('Check server logs / Sentry');
  }

  // Console / Client-side errors
  if (
    actualHints.some(h => /console|devtools|dev tools/i.test(h)) ||
    /console|devtools|dev tools|red text in console/i.test(lowerT)
  ) {
    actions.add('Check browser console logs');
  }

  // Performance
  if (
    actualHints.some(h => /\b(?:slow|lag|timeout|latency|load)/i.test(h)) ||
    /\b(?:slow|lag|timeout|latency|load)/i.test(lowerT)
  ) {
    actions.add('Check network traces');
  }

  // Network / DNS
  if (
    actualHints.some(h => /dns|nxdomain|modem|router|internet|wifi|cellular/i.test(h)) ||
    /dns|nxdomain|modem|router|internet|wifi|cellular/i.test(lowerT)
  ) {
    actions.add('Check DNS records / Network connectivity');
  }

  // Cloudflare / WAF
  if (
    actualHints.some(h => /cloudflare|ray id|waf|firewall block|security challenge|verification required/i.test(h)) ||
    /cloudflare|ray id|waf|firewall block|security challenge|verification required/i.test(lowerT)
  ) {
    actions.add('Check Cloudflare logs / WAF rules');
  }

  // Connection Refused / Firewall
  if (
    actualHints.some(h => /econns|reset|refused|firewall|blocked port|port binding/i.test(h)) ||
    /econns|reset|refused|connrefused|firewall|blocked port|port binding/i.test(lowerT)
  ) {
    actions.add('Check port binding / Firewall rules');
  }

  // SSL / TLS / Certificates
  if (
    actualHints.some(h => /ssl|tls|cert|handshake|clock skew|clock sync/i.test(h)) ||
    /ssl|tls|cert|handshake|clock skew|clock sync/i.test(lowerT)
  ) {
    actions.add('Check SSL/TLS certificates / Clock synchronization');
  }

  // VPN / Offline
  if (
    actualHints.some(h => /vpn|proxy|tunnel|offline|no internet/i.test(h)) ||
    /vpn|proxy|tunnel|offline|no internet/i.test(lowerT)
  ) {
    actions.add('Check VPN status / Network connectivity');
  }

  // Auth / Permissions
  if (
    actualHints.some(h => /401|403|permission|access|denied|forbidden|login|sign in|auth|session expir|invalid session|invalid token|csrf|xsrf|jwt/i.test(h)) ||
    /401|403|permission|access|denied|forbidden|login|sign in|auth|unauthorized|log in|signin|signup|session expir|invalid session|invalid token|csrf|xsrf|jwt/i.test(lowerT)
  ) {
    actions.add('Check permissions / user roles');
  }

  // Audio / Video Devices
  if (
    actualHints.some(h => /camera|microphone|webcam|no audio|no video|muted|black screen|can't hear|cannot hear|no sound/i.test(h)) ||
    /camera|microphone|webcam|no audio|no video|muted|black screen|can't hear|cannot hear|no sound/i.test(lowerT)
  ) {
    actions.add('Check Audio/Video permissions & device selection');
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

  // Design / Figma
  if (
    actualHints.some(h => /design|figma|mockup|sketch|doesn't match|looks different/i.test(h)) ||
    /design|figma|mockup|sketch|doesn't match|looks different/i.test(lowerT)
  ) {
    actions.add('Check Figma / Design specs');
  }

  // If mobile mentioned
  if (/ios|android|mobile|iphone|ipad/i.test(lowerT)) {
    actions.add('Test on physical device / simulator');
  }

  // Touch / Gestures
  if (
    actualHints.some(h => /swipe|pinch|zoom|gesture|touch|hard to tap|cant tap|cannot tap|unresponsive tap|\btap\s+(?:the|a|on)\b/i.test(h)) ||
    /swipe|pinch|zoom|gesture|touch|hard to tap|cant tap|cannot tap|unresponsive tap|\btap\s+(?:the|a|on)\b/i.test(lowerT)
  ) {
    actions.add('Check touch events / gestures');
  }

  // Database / Data
  if (
    actualHints.some(h => /duplicate key|foreign key|deadlock|unique constraint|serialization failure/i.test(h)) ||
    /database|sql|postgres|mongo|mysql|sqlite|prisma|drizzle|migration|seed|corrupt data|data integrity|duplicate key|foreign key|deadlock|unique constraint|serialization failure/i.test(lowerT)
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

  // GraphQL
  if (
    actualHints.some(h => /graphql|gql|schema error|variable \$|mutation failed/i.test(h)) ||
    /graphql|gql|schema error|variable \$|mutation failed/i.test(lowerT)
  ) {
    actions.add('Check GraphQL schema / operations');
  }

  // API Tools
  if (/postman|insomnia|curl|httpie/i.test(lowerT)) {
    actions.add('Reproduce via API client (Postman/curl)');
  }

  // Redis / Connection
  if (
    actualHints.some(h => /redis|connection refused|econnrefused|socket hang up/i.test(h)) ||
    /redis|connection refused|econnrefused|socket hang up/i.test(lowerT)
  ) {
    actions.add('Check Redis / backend connectivity');
  }

  // Websockets / Realtime
  if (
    actualHints.some(h => /websocket|ws:|wss:|socket\.io|pusher|signalr/i.test(h)) ||
    /websocket|ws:|wss:|socket\.io|pusher|signalr/i.test(lowerT)
  ) {
    actions.add('Check Websocket / Realtime logs');
  }

  // File Upload
  if (
    actualHints.some(h => /upload|attachment|file too large|payload too large|entity too large/i.test(h)) ||
    /upload|attachment|file too large|payload too large|entity too large/i.test(lowerT)
  ) {
    actions.add('Check file upload limits / S3');
  }

  // CDN / Assets
  if (
    actualHints.some(h => /broken image|missing image|image missing|image not loading|asset|cdn|icon|svg|png|jpg|webp/i.test(h)) ||
    /broken image|missing image|image missing|image not loading|asset|cdn/i.test(lowerT) ||
    /(?:broken|missing|failed|not show|not load).*(?:icon|svg|png|jpg|webp|image)/i.test(lowerT) ||
    /(?:icon|svg|png|jpg|webp|image).*(?:broken|missing|failed|not show|not load)/i.test(lowerT)
  ) {
    actions.add('Check CDN / Assets');
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

  // i18n / Translation
  if (
    actualHints.some(h => /translation|missing key|wrong language|incorrect language|still in english|not translated|language.*set to|i18n|locale|localization|shows.*key|displays.*key/i.test(h)) ||
    /translation|missing key|wrong language|incorrect language|still in english|not translated|language.*set to|i18n|locale|localization|shows.*key|displays.*key/i.test(lowerT)
  ) {
    actions.add('Check translations / i18n keys');
  }

  // Variable interpolation
  if (
    lowerT.includes('{{') || lowerT.includes('}}') || /interpolation|placeholder/i.test(lowerT)
  ) {
    actions.add('Check variable interpolation');
  }

  // Search / Filtration
  if (
    actualHints.some(h => /search|filter|sort|query|no results|found nothing/i.test(h)) ||
    /search|filter|sort|query|no results|found nothing/i.test(lowerT)
  ) {
    actions.add('Check search indexing / query logic');
  }

  // Accessibility / Keyboard
  if (
    actualHints.some(h => /accessibility|a11y|screen reader|voiceover|talkback|keyboard|tab order|focus|contrast/i.test(h)) ||
    /accessibility|a11y|screen reader|voiceover|talkback|keyboard|tab order|focus|contrast/i.test(lowerT)
  ) {
    actions.add('Check accessibility / keyboard navigation');
  }

  // SEO / Meta Tags
  if (
    actualHints.some(h => /seo|search engine|meta tag|meta description|robots\.txt|sitemap|crawler|googlebot|indexing/i.test(h)) ||
    /seo|search engine|meta tag|meta description|robots\.txt|sitemap|crawler|googlebot|indexing/i.test(lowerT)
  ) {
    actions.add('Check SEO settings / meta tags');
  }

  // Pagination
  if (
    actualHints.some(h => /pagination|page \d|next page|load more|infinite scroll/i.test(h)) ||
    /pagination|page \d|next page|load more|infinite scroll/i.test(lowerT)
  ) {
    actions.add('Check pagination logic / offset');
  }

  // Timezone / Date
  if (
    actualHints.some(h => /timezone|utc|pst|est|gmt|wrong time|date format|invalid date/i.test(h)) ||
    /timezone|wrong time|date format|invalid date|utc|pst|est|gmt/i.test(lowerT)
  ) {
    actions.add('Check timezone conversions / formatting');
  }

  // PDF / Document Generation
  if (
    actualHints.some(h => /pdf|export|download report|generate document|corrupted file/i.test(h)) ||
    /pdf|export|download report|generate document|corrupted file/i.test(lowerT)
  ) {
    actions.add('Check PDF generation / Export service');
  }

  // Email / Notifications
  if (
    actualHints.some(h => /email|mail|inbox|spam|bounce|did not receive|didn't receive|notification|deliverability/i.test(h)) ||
    /email|mail|inbox|spam|bounce|did not receive|didn't receive|notification|deliverability/i.test(lowerT)
  ) {
    actions.add('Check email service / spam');
  }

  // Extensions / Ad blockers
  if (
    actualHints.some(h => /extension|ad\s*block|ublock|ghostery|privacy badger|script blocker|popup blocker/i.test(h)) ||
    /extension|ad\s*block|ublock|ghostery|privacy badger|script blocker|popup blocker/i.test(lowerT)
  ) {
    actions.add('Check browser extensions / ad blockers');
  }

  // Feature Flags / Rollouts
  if (
    actualHints.some(h => /feature flag|feature toggle|rollout|experiment|launchdarkly|split\.io|statsig|growthbook|posthog|a\/b test|canary/i.test(h)) ||
    /feature flag|feature toggle|rollout|experiment|launchdarkly|split\.io|statsig|growthbook|posthog|a\/b test|canary/i.test(lowerT)
  ) {
    actions.add('Check feature flags / rollout status');
  }

  // Payment / Billing
  if (
    actualHints.some(h => /stripe|payment|card|billing|invoice|subscription|upgrade|downgrade|proration/i.test(h)) ||
    /stripe|payment|card|billing|invoice|subscription|upgrade|downgrade|proration/i.test(lowerT)
  ) {
    actions.add('Check Stripe logs / Billing status');
  }

  // Memory / OOM
  if (
    actualHints.some(h => /oom|out of memory|memory leak|heap limit|allocation failed/i.test(h)) ||
    /oom|out of memory|memory leak|heap limit|allocation failed/i.test(lowerT)
  ) {
    actions.add('Check memory usage / OOM');
  }

  // Disk Space
  if (
    actualHints.some(h => /disk full|no space left|disk space/i.test(h)) ||
    /disk full|no space left|disk space/i.test(lowerT)
  ) {
    actions.add('Check disk space / cleanup');
  }

  // Integrations (Slack / Salesforce / HubSpot / etc)
  if (
    actualHints.some(h => /slack|salesforce|hubspot|zapier|zoom|google calendar|outlook|linear|jira|github|gitlab|trello|asana|notion|monday|clickup/i.test(h)) ||
    /slack|salesforce|hubspot|zapier|zoom|google calendar|outlook|linear|jira|github|gitlab|trello|asana|notion|monday|clickup/i.test(lowerT)
  ) {
    actions.add('Check third-party integrations (Slack/Salesforce/etc)');
  }

  // Analytics / Telemetry
  if (
    actualHints.some(h => /segment|mixpanel|amplitude|google analytics|ga4|analytics|telemetry|tracking event/i.test(h)) ||
    /segment|mixpanel|amplitude|google analytics|ga4|analytics|telemetry|tracking event/i.test(lowerT)
  ) {
    actions.add('Check analytics / telemetry logs');
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
        if (u.pathname && u.pathname !== '/') {
          out.add(u.pathname);
        } else if (u.hostname && !u.hostname.includes('fathom.video')) {
          out.add(u.hostname);
        }
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
    if (/^\/[\w\-\.\/?=&%]+$/.test(clean) && clean.length >= 2 && /[a-zA-Z]/.test(clean)) {
      out.add(clean);
    }
  }
  return [...out];
}

function formatSeconds(s) {
  const sec = parseInt(s, 10);
  if (isNaN(sec)) return null;
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function extractTimestampFromUrl(url) {
  const match = String(url || '').match(/[?&]t=(\d+)/);
  if (match) {
    return formatSeconds(match[1]);
  }
  return null;
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
  reproSteps,
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

  // If the source URL has a timestamp (e.g. ?t=65), promote it to the top.
  const urlTs = extractTimestampFromUrl(src);
  if (urlTs) {
    timestamps.unshift(`${urlTs} (from URL)`);
  }

  const severity = extractSeverity(transcript);
  const envLikely = extractEnvironment(transcript);
  const buildNum = extractBuildNumber(transcript);
  const speakers = extractSpeakers(transcript);
  const paths = extractPaths(transcript);
  const hints = extractBugHints(transcript);
  const nextActions = generateNextActions(transcript, hints.actual);
  const extractedRepro = extractReproSteps(transcript);
  const stackTraces = extractStackTraces(transcript);
  
  // Prefer passed-in repro steps, then extracted steps, then default placeholders.
  let repro = Array.isArray(reproSteps) ? reproSteps : (reproSteps ? [reproSteps] : []);
  if (!repro.length && extractedRepro.length > 0) {
    repro = extractedRepro;
  }

  const header = [
    '# Bug report brief',
    '',
    `Source: ${src || '(unknown)'}`,
    `Title: ${t || '(unknown)'}`,
    `Suggested issue title: ${desc || t || '(unknown)'}`,
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
    ...(repro.length ? repro.map((step, i) => `${i+1}. ${step}`) : ['1. ', '2. ', '3. ']),
    '',
    '## Expected vs actual',
    `- Expected: ${hints.expected.length ? hints.expected.join(' / ') : ''}`,
    `- Actual: ${hints.actual.length ? hints.actual.join(' / ') : ''}`,
    '',
    '## Environment / context',
    ...(severity ? [`- Severity: ${severity}`] : []),
    `- Who: ${speakers.length ? speakers.join(', ') : (auth || '(unknown)')}`,
    `- Where (page/URL): ${paths.length ? paths.join(', ') : ''}`,
    `- Browser / OS: ${envLikely || '(unknown)'}`,
    `- Build / SHA: ${buildNum || ''}`,
    `- When: ${d || '(unknown)'}`,
    '',
    '## Attachments / evidence',
    '- Screenshot(s): ',
    '- Console/logs: ',
    ...(stackTraces.length ? ['```', ...stackTraces, '```'] : []),
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
