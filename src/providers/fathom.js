function cleanUrlInput(url) {
  let s = String(url || '').trim();
  if (!s) return '';

  // Provider parity: HTML copy/paste often escapes query separators.
  s = s.replace(/&amp;/gi, '&').replace(/&#0*38;/gi, '&');

  // Provider parity: accept angle-wrapped links (common in markdown/chat), including Slack-style <url|label>.
  const slack = s.match(/^<\s*([^|>\s]+)\s*\|[^>]*>$/i);
  if (slack) s = String(slack[1] || '').trim();
  const angle = s.match(/^<\s*([^>\s]+)\s*>$/i);
  if (angle) s = String(angle[1] || '').trim();

  // Provider parity: URLs pasted in chat are often wrapped in quotes.
  for (let i = 0; i < 2; i++) {
    const first = s.slice(0, 1);
    const last = s.slice(-1);
    // Standard quotes, backtick, and Unicode quotes (smart quotes, guillemets, angle quotes)
    const q = ['"', "'", '`', '\u201c', '\u201d', '\u2018', '\u2019', '\u00ab', '\u00bb', '\u2039', '\u203a'];
    let changed = false;
    if (q.includes(first)) {
      s = s.slice(1).trim();
      changed = true;
    }
    if (q.includes(last)) {
      s = s.slice(0, -1).trim();
      changed = true;
    }
    if (!changed) break;
  }

  // Strip lightweight trailing punctuation first so wrappers like "(https://...)\." can be unwrapped.
  for (let i = 0; i < 4; i++) {
    const stripped = s.replace(/[.,;:!?…。！，？。､、]+$/g, '').trim();
    if (stripped.length === s.length) break;
    s = stripped;
  }

  const unwrap = [
    [/^\((.*)[)）]$/, 1],
    [/^\[(.*)\]$/, 1],
    [/^\{(.*)\}$/, 1],
  ];
  for (const [re] of unwrap) {
    const m = s.match(re);
    if (m && m[1]) {
      s = String(m[1]).trim();
      break;
    }
  }

  // After unwrapping parentheses, re-handle angle-bracket wrappers.
  const slack2 = s.match(/^<\s*([^|>\s]+)\s*\|[^>]*>$/i);
  if (slack2) s = String(slack2[1] || '').trim();
  const angle2 = s.match(/^<\s*([^>\s]+)\s*>$/i);
  if (angle2) s = String(angle2[1] || '').trim();

  // Common copy/paste pattern: "https://... (Fathom)".
  s = s.replace(/\s+\([^)]*\)\s*$/g, '');

  for (let i = 0; i < 3; i++) {
    // Strip trailing punctuation including Unicode variants
    const stripped = s.replace(/[)\]>'"`\u201c\u201d\u2018\u2019\u00ab\u00bb\u2039\u203a.,;:!?…。！，？。､、）】〉》」』}]+$/g, '').trim();
    if (stripped.length === s.length) break;

    if (s.endsWith(')') && stripped.length < s.length) {
      const openCount = (stripped.match(/\(/g) || []).length;
      const closeCount = (stripped.match(/\)/g) || []).length;
      if (openCount > closeCount && s.slice(stripped.length).startsWith(')')) {
        s = (stripped + ')').trim();
        continue;
      }
    }

    s = stripped;
  }

  return s;
}

function withScheme(s) {
  const v = cleanUrlInput(s);
  if (!v) return '';

  // Accept protocol-relative URLs like "//fathom.video/share/...".
  if (v.startsWith('//')) return `https:${v}`;

  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

export function extractFathomId(url) {
  const s0 = withScheme(url);
  if (!s0) return null;

  let u;
  try {
    u = new URL(s0);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  if (!/(^|\.)fathom\.video$/i.test(host)) return null;

  const parts = (u.pathname || '/')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const kind = String(parts[0] || '').toLowerCase();
  if (!['share', 'recording'].includes(kind)) return null;

  const id = String(parts[1] || '').trim();
  return /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
}

export function isFathomUrl(url) {
  return !!extractFathomId(url);
}

// Provider parity: check if URL is a Fathom domain (similar to isLoomDomain/isVimeoDomain/isYoutubeDomain).
export function isFathomDomain(url) {
  const s = withScheme(url);
  if (!s) return false;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    return /(^|\.)fathom\.video$/i.test(host);
  } catch {
    return false;
  }
}

// Normalize common Fathom URL shapes to a canonical share URL.
// Provider parity: similar to Loom/YouTube/Vimeo normalization.
export function normalizeFathomUrl(url) {
  const s = withScheme(url);
  if (!s) return '';

  let u;
  try {
    u = new URL(s);
  } catch {
    return String(url || '').trim();
  }

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  if (!/(^|\.)fathom\.video$/i.test(host)) return u.toString();

  const id = extractFathomId(u.toString());
  if (!id) return u.toString();

  // Canonical form: https://fathom.video/share/<id>
  const out = new URL(`https://fathom.video/share/${id}`);

  // Preserve deep-link timestamps if present.
  const t = u.searchParams.get('t') || u.searchParams.get('start') || '';
  if (t) out.searchParams.set('t', t);

  const hash = String(u.hash || '').replace(/^#/, '').trim();
  if (hash) {
    const hp = new URLSearchParams(hash);
    const ht = hp.get('t') || hp.get('start') || '';
    if (ht && !out.searchParams.get('t')) out.searchParams.set('t', ht);
  }

  return out.toString();
}

// Detect Fathom non-video pages and return actionable guidance.
// Provider parity: similar to loomNonVideoReason/youtubeNonVideoReason/vimeoNonVideoReason.
export function fathomNonVideoReason(url) {
  const s = withScheme(url);
  if (!s) return '';

  let u;
  try {
    u = new URL(s);
  } catch {
    return '';
  }

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  if (!/(^|\.)fathom\.video$/i.test(host)) return '';

  // If it's a valid Fathom video URL, don't flag it.
  if (extractFathomId(s)) return '';

  const segs = (u.pathname || '/')
    .split('/')
    .map((x) => x.trim())
    .filter(Boolean);
  const first = String(segs[0] || '').toLowerCase();

  // Common non-video sections on Fathom.
  const nonVideo = new Set([
    '',
    'login',
    'logout',
    'signup',
    'sign-up',
    'pricing',
    'enterprise',
    'teams',
    'features',
    'integrations',
    'security',
    'careers',
    'blog',
    'help',
    'support',
    'settings',
    'terms',
    'privacy',
    'auth',
    'account',
    'dashboard',
    'admin',
    'api',
    'docs',
    'documentation',
  ]);

  if (nonVideo.has(first)) {
    return 'This Fathom URL does not appear to be a direct video link. Please provide a Fathom share URL like https://fathom.video/share/<id> instead.';
  }

  // Generic Fathom domain but not a recognized video path.
  return 'This Fathom URL does not appear to be a direct video link. Please provide a Fathom share URL like https://fathom.video/share/<id> instead.';
}

export function extractFathomTranscriptUrl(html) {
  const h = String(html || '');
  if (!h) return null;

  // JSON blobs in scripts often include: copyTranscriptUrl: "..."
  const m1 = h.match(/(?:["']?copyTranscriptUrl["']?)\s*[:=]\s*"(?<u>https?:\/\/[^"\s]+copy_transcript[^"\s]*)"/i);
  if (m1?.groups?.u) return String(m1.groups.u).replace(/\\u002F/gi, '/').replace(/\\\//g, '/');

  // Direct links
  const m2 = h.match(/href\s*=\s*"(?<u>https?:\/\/[^"\s]+copy_transcript[^"\s]*)"/i);
  if (m2?.groups?.u) return String(m2.groups.u).replace(/\\u002F/gi, '/').replace(/\\\//g, '/');

  return null;
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractBalancedJsonObject(source, startIndex) {
  let depth = 0;
  let inStr = false;
  let quote = '';
  let escaped = false;

  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i];

    if (inStr) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        inStr = false;
        quote = '';
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inStr = true;
      quote = ch;
      continue;
    }

    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(startIndex, i + 1);
    }
  }
  return '';
}

function unescapeJsonSlashes(s) {
  return String(s || '')
    .replace(/\\u([0-9a-fA-F]{4})/g, (m, hex) => {
      try {
        const n = Number.parseInt(String(hex), 16);
        if (!Number.isFinite(n)) return m;
        return String.fromCharCode(n);
      } catch {
        return m;
      }
    })
    .replace(/\\\//g, '/');
}

function normalizeFathomAssetUrl(url, base = 'https://fathom.video') {
  const v = String(url || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith('//')) return `https:${v}`;
  if (v.startsWith('/')) return `${base}${v}`;
  return v;
}

// Extract any JSON URL by key from HTML (for mediaUrl, downloadUrl, etc.)
function extractAnyJsonUrls(html, keys = []) {
  const h = String(html || '');
  const hScan = unescapeJsonSlashes(h);

  const decodeJsonStringLiteral = (literal) => {
    const raw = String(literal || '').trim();
    if (!raw) return '';
    const q = raw[0];
    if ((q === '"' || q === "'") && raw.endsWith(q)) {
      const inner = raw.slice(1, -1);
      try {
        const safe = `"${inner.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
        return JSON.parse(safe);
      } catch {
        return inner;
      }
    }
    return raw;
  };

  for (const k of keys) {
    // Quoted JSON/JS strings
    const reQuoted = new RegExp(
      `(?:["']?${k}["']?)\\s*[:=]\\s*(\\"(?:\\\\.|[^\\\"])*\\"|'(?:\\\\.|[^'])*')`,
      'i'
    );
    const mQ = h.match(reQuoted);
    if (mQ) {
      const decoded = decodeJsonStringLiteral(mQ[1]);
      return unescapeJsonSlashes(decoded);
    }

    // Unquoted/bare URL tokens
    const reBare = new RegExp(
      `(?:["']?${k}["']?)\\s*[:=]\\s*(?<u>(?:https?:\/\/|\/\/)[^\\"'\\s\\r\\n;,)\\]}>]+)`,
      'i'
    );
    const mB = hScan.match(reBare);
    if (mB?.groups?.u) {
      const raw = String(mB.groups.u || '').trim();
      return raw.startsWith('//') ? `https:${raw}` : raw;
    }
  }
  return '';
}

// Provider parity: extract metadata from Fathom HTML similar to YouTube/Vimeo/Loom
export function extractFathomMetadataFromHtml(html) {
  const h = String(html || '');
  if (!h.trim()) return {};

  const result = {
    title: undefined,
    description: undefined,
    author: undefined,
    duration: undefined,
    thumbnailUrl: undefined,
    mediaUrl: undefined,
    transcriptUrl: undefined,
    date: undefined,
  };

  // Try to extract from meta tags first (OpenGraph/Twitter Card)
  const ogTitle = h.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']*)["'][^>]*>/i)?.[1];
  const ogDesc = h.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["'][^>]*>/i)?.[1];
  const ogImage = h.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']*)["'][^>]*>/i)?.[1];
  const twitterTitle = h.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']*)["'][^>]*>/i)?.[1];
  const twitterDesc = h.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']*)["'][^>]*>/i)?.[1];

  // Try JSON-LD structured data
  let ldData = null;
  const ldMatch = h.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (ldMatch) {
    ldData = safeJsonParse(ldMatch[1]);
  }

  // Set title from various sources
  result.title = ogTitle || twitterTitle || ldData?.name || undefined;

  // Set description
  result.description = ogDesc || twitterDesc || ldData?.description || undefined;

  // Set thumbnail
  result.thumbnailUrl = ogImage || ldData?.thumbnailUrl || ldData?.image || undefined;

  // Set author from JSON-LD
  if (ldData?.author?.name) {
    result.author = ldData.author.name;
  }

  // Set date from JSON-LD
  if (ldData?.uploadDate) {
    result.date = ldData.uploadDate;
  }

  // Extract transcript URL
  const transcriptUrl = extractFathomTranscriptUrl(h);
  if (transcriptUrl) {
    result.transcriptUrl = normalizeFathomAssetUrl(transcriptUrl);
  }

  // Extract media URL from JSON blobs (common keys used by Fathom)
  const mediaUrl = extractAnyJsonUrls(h, ['downloadUrl', 'mediaUrl', 'videoUrl', 'playbackUrl', 'sourceUrl']);
  if (mediaUrl) {
    result.mediaUrl = normalizeFathomAssetUrl(mediaUrl);
  }

  // Try to extract duration from JSON-LD or common patterns
  if (ldData?.duration) {
    // ISO 8601 duration format: PT1H2M3S
    const isoMatch = String(ldData.duration).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
    if (isoMatch) {
      const hours = Number(isoMatch[1] || 0);
      const mins = Number(isoMatch[2] || 0);
      const secs = Number(isoMatch[3] || 0);
      result.duration = hours * 3600 + mins * 60 + secs;
    } else {
      const numeric = Number(ldData.duration);
      if (Number.isFinite(numeric)) {
        result.duration = numeric;
      }
    }
  }

  return result;
}

// Provider parity: fetch oEmbed data for Fathom videos
// Fathom doesn't have a public oEmbed endpoint, but this function provides API parity
// with YouTube/Vimeo/Loom providers. It returns null gracefully.
export async function fetchFathomOembed(url) {
  // Fathom does not currently expose a public oEmbed endpoint.
  // This function exists for provider API parity and returns null.
  // Future: If Fathom adds oEmbed support, implement the fetch here.
  return null;
}

// Provider parity: fetch media URL for Fathom videos (similar to fetchLoomMediaUrl/fetchVimeoMediaUrl/fetchYoutubeMediaUrl)
// Fetches the Fathom page and extracts the direct video URL from JSON blobs in the HTML.
export async function fetchFathomMediaUrl(url) {
  try {
    const normalized = normalizeFathomUrl(String(url || ''));
    if (!normalized) return null;

    const res = await fetch(normalized, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const meta = extractFathomMetadataFromHtml(html);
    return meta?.mediaUrl || null;
  } catch {
    return null;
  }
}

// NOTE: full fathom extraction is implemented in src/extractor.js. This provider module
// keeps compatibility exports used by unit tests.
export async function extractFathom(url, page) {
  return { title: '', transcript: '', sourceUrl: url };
}
