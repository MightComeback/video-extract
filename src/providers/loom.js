import { parseSimpleVtt } from '../utils.js';

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
  // Examples:
  //  - “https://loom.com/share/<id>”
  //  - «https://loom.com/share/<id>?sid=...»,
  for (let i = 0; i < 2; i++) {
    const first = s.slice(0, 1);
    const last = s.slice(-1);
    const q = ['"', "'", '`', '“', '”', '‘', '’', '«', '»', '‹', '›'];
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

  // After unwrapping parentheses, re-handle angle-bracket wrappers (e.g. "(<https://...>)").
  const slack2 = s.match(/^<\s*([^|>\s]+)\s*\|[^>]*>$/i);
  if (slack2) s = String(slack2[1] || '').trim();
  const angle2 = s.match(/^<\s*([^>\s]+)\s*>$/i);
  if (angle2) s = String(angle2[1] || '').trim();

  // Common copy/paste pattern: "https://... (Loom)".
  s = s.replace(/\s+\([^)]*\)\s*$/g, '');

  for (let i = 0; i < 3; i++) {
    const stripped = s.replace(/[)\]>'\"`“”‘’»«›‹.,;:!?…。！，？。､、）】〉》」』}]+$/g, '').trim();
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

  // Accept protocol-relative URLs like "//loom.com/share/...".
  if (v.startsWith('//')) return `https:${v}`;

  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

export function isLoomUrl(url) {
  return !!extractLoomId(url);
}

// Normalize common Loom URL shapes to a canonical share URL.
// Preserves the Loom session id (?sid=...) when present so private shares keep working.
export function normalizeLoomUrl(url) {
  const s = withScheme(url);
  if (!s) return '';

  let u;
  try {
    u = new URL(s);
  } catch {
    return String(url || '').trim();
  }

  // Only normalize Loom domains.
  // Provider parity: older Loom links sometimes use useloom.com.
  const host = u.hostname.toLowerCase();
  const isLoomHost = /(^|\.)loom\.com$/i.test(host) || /(^|\.)useloom\.com$/i.test(host);
  if (!isLoomHost) return u.toString();

  const id = extractLoomId(u.toString());
  if (!id) return u.toString();

  // Canonical host: loom.com (matches README + brief normalization, avoids extra redirects).
  const out = new URL(`https://loom.com/share/${id}`);

  // Preserve session id for private Loom links.
  const sid = u.searchParams.get('sid');
  if (sid) out.searchParams.set('sid', sid);

  // Provider parity: Loom share URLs often include extra tracking params.
  // Only preserve parameters that affect access (sid) or deep-linking (t/start).
  const t = u.searchParams.get('t') || u.searchParams.get('start');
  if (t) out.searchParams.set('t', t);

  // Some share flows use hash deep-links (e.g. #t=30s). Preserve those too.
  const hash = String(u.hash || '').replace(/^#/, '').trim();
  if (hash) {
    const hp = new URLSearchParams(hash);
    const ht = hp.get('t') || hp.get('start');
    if (ht && !out.searchParams.get('t')) out.searchParams.set('t', ht);
  }

  return out.toString();
}

export function isLoomDomain(url) {
  const s = withScheme(url);
  if (!s) return false;

  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    return /(^|\.)loom\.com$/i.test(host) || /(^|\.)useloom\.com$/i.test(host);
  } catch {
    return false;
  }
}

// Some Loom URLs are not direct video pages (pricing/login/etc).
// Return a short actionable reason when we can detect this.
export function loomNonVideoReason(url) {
  const s = withScheme(url);
  if (!s) return '';

  let u;
  try {
    u = new URL(s);
  } catch {
    return '';
  }

  const host = u.hostname.toLowerCase();
  if (!/(^|\.)loom\.com$/i.test(host) && !/(^|\.)useloom\.com$/i.test(host)) return '';

  // If it's a valid Loom video URL, don't flag it.
  if (extractLoomId(s)) return '';

  const segs = (u.pathname || '/').split('/').map((x) => x.trim()).filter(Boolean);
  const first = String(segs[0] || '').toLowerCase();

  // Common non-video sections.
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
  ]);

  if (nonVideo.has(first)) {
    return 'This Loom URL does not appear to be a direct video link. Please provide a Loom share URL like https://loom.com/share/<id> instead.';
  }

  // Generic Loom domain but not a recognized video path.
  return 'This Loom URL does not appear to be a direct video link. Please provide a Loom share URL like https://loom.com/share/<id> instead.';
}

function isVttUrl(u) {
  const s = String(u || '').trim();
  if (!s) return false;
  return (
    /\.vtt(?:\?|#|$)/i.test(s) ||
    /[?&](?:format|fmt)=(?:vtt|webvtt)(?:&|$)/i.test(s)
  );
}

function normalizeLoomAssetUrl(url, base = 'https://www.loom.com') {
  const v = String(url || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith('//')) return `https:${v}`;
  if (v.startsWith('/')) return `${base}${v}`;
  return v;
}

export function extractLoomId(url) {
  const s = withScheme(url);
  if (!s) return null;

  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase();
  // Loom links can come from subdomains (e.g. share.loom.com).
  // Provider parity: older Loom links sometimes use useloom.com.
  if (!/(^|\.)loom\.com$/i.test(host) && !/(^|\.)useloom\.com$/i.test(host)) return null;

  const parts = u.pathname.split('/').filter(Boolean);

  // Provider parity: some Loom share flows produce bare URLs like:
  //   https://loom.com/<id>
  // Treat these as share URLs when the token looks like a Loom id.
  if (parts.length === 1) {
    const only = parts[0];
    // Keep this conservative to avoid matching non-video paths.
    if (/^[a-zA-Z0-9_-]{10,}$/.test(only || '')) return only;
    return null;
  }

  if (parts.length < 2) return null;

  const kind = parts[0];
  // Loom has used a few URL shapes over time.
  // Common:
  //  - /share/<id>
  //  - /v/<id>
  //  - /embed/<id>
  //  - /recording/<id>
  // Older/alternate (seen in the wild):
  //  - /i/<id>
  //  - /s/<id>
  if (!['share', 's', 'v', 'embed', 'recording', 'i'].includes(kind)) return null;

  const id = parts[1];
  return /^[a-zA-Z0-9_-]+$/.test(id || '') ? id : null;
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

export function extractLoomMetadataFromHtml(html) {
  let meta = {};

  try {
    // 1. Apollo State (Preferred)
    const h = String(html || '');
    const idx = h.search(/window\.__APOLLO_STATE__\s*=\s*\{/);
    if (idx !== -1) {
      const brace = h.indexOf('{', idx);
      const obj = extractBalancedJsonObject(h, brace);
      const state = obj ? JSON.parse(obj) : null;
      if (state && typeof state === 'object') {

      // Find the main video object
      const videoKey = Object.keys(state).find((k) =>
        k.startsWith('RegularUserVideo:') ||
        k.startsWith('LoomVideo:') ||
        // Provider parity: Loom has used different typename prefixes over time.
        // Keep this permissive to avoid breaking when the Apollo cache key changes.
        k.startsWith('Video:')
      );
      if (videoKey && state[videoKey]) {
        const vid = state[videoKey];
        meta.title = vid.name;
        meta.description = vid.description;
        meta.date = vid.createdAt;
        meta.id = vid.id;

        if (vid.duration) meta.duration = vid.duration;

        // Prefer MP4 over M3U8.
        const cdnKeys = Object.keys(vid).filter((k) => k.startsWith('nullableRawCdnUrl'));
        const mp4Key = cdnKeys.find((k) => /MP4/i.test(k));
        const m3u8Key = cdnKeys.find((k) => /M3U8/i.test(k)) || cdnKeys[0];
        const chosen = mp4Key || m3u8Key;
        if (chosen && vid[chosen]?.url) {
          meta.mediaUrl = normalizeLoomAssetUrl(vid[chosen].url);
        } else if (vid.nullableRawCdnUrl?.url) {
          meta.mediaUrl = normalizeLoomAssetUrl(vid.nullableRawCdnUrl.url);
        }

        if (vid.posterUrl && !meta.thumbnailUrl) meta.thumbnailUrl = vid.posterUrl;

        if (vid.owner && vid.owner.__ref) {
          const owner = state[vid.owner.__ref];
          if (owner) {
            meta.author = [owner.firstName, owner.lastName].filter(Boolean).join(' ');
          }
        }

        // Transcript url (VideoTranscriptDetails)
        // Loom pages can contain multiple transcript detail objects; prefer the one linked to the current video.
        const vtdKeys = Object.keys(state).filter((k) => k.startsWith('VideoTranscriptDetails:'));
        const pickVtdKey = () => {
          if (!vtdKeys.length) return '';

          // Prefer an object explicitly linked to this video.
          for (const k of vtdKeys) {
            const vtd = state[k] || {};
            const vtdVideoRef = vtd?.video?.__ref;
            const vtdVideoId = vtd?.videoId || vtd?.video_id;
            if ((vtdVideoRef && vtdVideoRef === videoKey) || (vtdVideoId && String(vtdVideoId) === String(vid.id))) {
              return k;
            }
          }

          return vtdKeys[0];
        };

        const vtdKey = pickVtdKey();
        if (vtdKey) {
          const vtd = state[vtdKey] || {};
          // Loom has used both `source_url` (JSON transcript) and `captions_source_url` (VTT) over time.
          const captions = vtd.captions_source_url;
          const source = vtd.source_url;

          // Prefer VTT (more consistent) over JSON when both exist.
          const preferred =
            (isVttUrl(captions) ? captions : '') ||
            (isVttUrl(source) ? source : '') ||
            captions ||
            source ||
            '';

          meta.transcriptUrl = normalizeLoomAssetUrl(preferred) || meta.transcriptUrl;
        }

        // Transcript text (Transcript paragraphs)
        let transcriptRef = null;
        if (vid.transcript && vid.transcript.__ref) transcriptRef = vid.transcript.__ref;
        if (!transcriptRef) transcriptRef = Object.keys(state).find((k) => k.startsWith('Transcript:'));

        if (transcriptRef && state[transcriptRef]) {
          const tParams = state[transcriptRef].paragraphs;
          if (Array.isArray(tParams)) {
            const paragraphs = tParams
              .map((ref) => {
                if (ref && ref.__ref) return state[ref.__ref];
                return ref;
              })
              .filter((p) => p && p.text);

            if (paragraphs.length) {
              meta.transcriptText = paragraphs
                .map((p) => {
                  const text = cleanLoomCaptionText(p?.text);
                  if (!text) return '';
                  return `${formatTime(p?.startTime || 0)} ${text}`;
                })
                .filter(Boolean)
                .join('\n');
            }
          }
        }
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. Fallback to LD+JSON
  if (!meta.title) {
    const ldMatch = String(html || '').match(/<script type="application\/ld\+json">\s*(\{[\s\S]*?\})\s*<\/script>/);
    if (ldMatch) {
      try {
        const ld = JSON.parse(ldMatch[1]);
        if (ld['@type'] === 'VideoObject') {
          meta.title = ld.name;
          meta.description = ld.description;
          meta.date = ld.uploadDate;
          meta.thumbnailUrl = ld.thumbnailUrl;
          if (ld.author && ld.author.name) meta.author = ld.author.name;
        }
      } catch {
        // ignore
      }
    }
  }

  return meta;
}

function formatTime(seconds) {
  const s = Math.floor(Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function cleanLoomCaptionText(s) {
  let v = String(s || '');
  if (!v) return '';

  // Loom transcript JSON sometimes contains lightweight markup similar to WebVTT.
  v = v.replace(/<[^>]+>/g, '');

  // Decode a small deterministic set of entities (mirrors utils.parseSimpleVtt behavior).
  v = v
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '…')
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&rsquo;/gi, '’')
    .replace(/&lrm;/gi, '')
    .replace(/&rlm;/gi, '')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");

  // Decode numeric entities (e.g. &#8217; or &#x2019;).
  v = v.replace(/&#(x?[0-9a-fA-F]+);?/g, (m, rawNum) => {
    try {
      const isHex = String(rawNum).toLowerCase().startsWith('x');
      const n = Number.parseInt(isHex ? String(rawNum).slice(1) : String(rawNum), isHex ? 16 : 10);
      if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return m;
      return String.fromCodePoint(n);
    } catch {
      return m;
    }
  });

  return v.replace(/\s+/g, ' ').trim();
}

export function parseLoomTranscript(text) {
  const raw = String(text || '');

  // Loom transcript endpoints sometimes return WebVTT.
  // Treat those as VTT and extract plain text for better provider parity.
  if (/^\s*WEBVTT\b/i.test(raw) || /\d{2}:\d{2}(?::\d{2})?\.\d{3}\s*-->\s*\d{2}:\d{2}(?::\d{2})?\.\d{3}/.test(raw)) {
    return parseSimpleVtt(raw);
  }

  try {
    const data = JSON.parse(raw);

    // Common Loom transcript JSON shapes we've seen in the wild:
    //  - { paragraphs: [{ startTime, text }, ...] }
    //  - { segments: [{ start, text }, ...] }
    //  - { transcript: [{ start, end, text }, ...] }
    //  - [{ startTime, text }, ...] (flat array)

    if (data && Array.isArray(data.paragraphs)) {
      return data.paragraphs
        .map((p) => {
          const text = cleanLoomCaptionText(p?.text);
          if (!text) return '';
          return `${formatTime(p?.startTime)} ${text}`;
        })
        .filter(Boolean)
        .join('\n');
    }

    // Some Loom exports use {segments:[{start,text}]}.
    if (data && Array.isArray(data.segments)) {
      return data.segments
        .map((s) => {
          const text = cleanLoomCaptionText(s?.text);
          if (!text) return '';
          return `${formatTime(s?.start)} ${text}`;
        })
        .filter(Boolean)
        .join('\n');
    }

    // Some Loom transcript endpoints return {transcript:[{start,end,text}]}.
    if (data && Array.isArray(data.transcript)) {
      return data.transcript
        .map((t) => {
          const text = cleanLoomCaptionText(t?.text);
          if (!text) return '';
          return `${formatTime(t?.start ?? t?.startTime)} ${text}`;
        })
        .filter(Boolean)
        .join('\n');
    }

    // As a last resort, accept a flat array of objects.
    if (Array.isArray(data) && data.length && typeof data[0] === 'object') {
      return data
        .map((t) => {
          const text = cleanLoomCaptionText(t?.text);
          if (!text) return '';
          return `${formatTime(t?.start ?? t?.startTime)} ${text}`;
        })
        .filter(Boolean)
        .join('\n');
    }
  } catch {
    // ignore
  }
  return raw;
}

export async function fetchLoomOembed(url) {
  try {
    const u = new URL('https://www.loom.com/v1/oembed');
    u.searchParams.set('url', String(url || ''));

    const res = await fetch(u.toString(), { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
