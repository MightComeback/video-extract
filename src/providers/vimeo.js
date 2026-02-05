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
  //  - “https://vimeo.com/<id>”
  //  - «https://vimeo.com/<id>?h=...»,
  // Be conservative: only strip a small set of leading/trailing quote wrappers.
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

  // Provider parity: URLs pasted in chat are often wrapped or followed by punctuation.
  // Examples:
  //  - (https://vimeo.com/<id>?h=...).
  //  - https://vimeo.com/<id>,
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

  // Common copy/paste pattern: "https://... (Vimeo)".
  // Only strip parenthetical suffixes when separated by whitespace.
  s = s.replace(/\s+\([^)]*\)\s*$/g, '');

  // Strip a conservative set of trailing chat punctuation, including common Unicode variants.
  // Keep roughly aligned with the YouTube provider's cleanUrlInput behavior.
  for (let i = 0; i < 3; i++) {
    const stripped = s.replace(/[)\]>'\"`“”‘’»«›‹.,;:!?…。！，？。､、）】〉》」』}]+$/g, '').trim();
    if (stripped.length === s.length) break;

    // Avoid stripping a closing paren when it appears to balance an open paren in the URL.
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

  // Accept protocol-relative URLs like "//player.vimeo.com/video/...".
  if (v.startsWith('//')) return `https:${v}`;

  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

// Helper: check if the extracted ID looks like a valid Vimeo video ID
function isValidVimeoId(id) {
  if (!id || typeof id !== 'string') return false;
  // Vimeo IDs are at least 3 digits (short codes can be 3+)
  const numId = String(id || '').trim();
  return /^\d{3,}$/.test(numId);
}

// Helper: check if a segment looks like a Vimeo ID
const isId = (x) => isValidVimeoId(x);

export function extractVimeoId(url) {
  const s = withScheme(url);
  if (!s) return null;

  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  // Vimeo pages can be served from vimeo.com or the embed host player.vimeo.com.
  if (!/(^|\.)vimeo\.com$/i.test(host) && host !== 'player.vimeo.com') return null;

  // Provider parity: some legacy embeds use clip_id query param (e.g. moogaloop.swf?clip_id=1234).
  // Treat those as video URLs when the clip_id is numeric.
  const clipId = String(u.searchParams.get('clip_id') || '').trim();
  if (/^\d{3,}$/.test(clipId)) return clipId;

  const segs = (u.pathname || '/')
    .split('/')
    .map((x) => x.trim())
    .filter(Boolean);

  // player.vimeo.com/video/<id>
  if (host === 'player.vimeo.com') {
    const idx = segs.findIndex((x) => x.toLowerCase() === 'video');
    const maybe = idx !== -1 ? segs[idx + 1] : '';
    return /^\d{3,}$/.test(maybe || '') ? maybe : null;
  }

  // Avoid false positives for non-video pages that contain date-like path segments.
  // Example: https://vimeo.com/blog/post/2026/02/03/... (not a clip).
  // We only accept IDs in common video URL positions.
  const blockedTopLevel = new Set([
    'blog',
    'help',
    'upgrade',
    'terms',
    'privacy',
    'about',
    'features',
    'api',
    'apps',
    'categories',
    'event',
    'events',
    // Provider parity: on-demand pages are not stable clip URLs (often paywalled).
    // We want these to fall through so vimeoNonVideoReason can produce a clear actionable error.
    'ondemand',
  ]);

  const first = (segs[0] || '').toLowerCase();
  const isBlocked = blockedTopLevel.has(first);

  // Provider parity / correctness:
  // Vimeo showcases are collections. The top-level showcase URL is *not* a clip URL.
  // Only treat showcases as videos when the URL explicitly includes a video id, e.g.:
  //   https://vimeo.com/showcase/<showcaseId>/video/<videoId>
  if (first === 'showcase' && !segs.some((x) => String(x || '').toLowerCase() === 'video')) {
    return null;
  }

  const isId = (x) => /^\d{3,}$/.test(String(x || ''));

  // Provider parity: Vimeo "manage" links (seen when copying from the dashboard).
  // Examples:
  //   https://vimeo.com/manage/videos/123456789
  //   https://vimeo.com/manage/video/123456789
  // (Sometimes followed by additional segments like /advanced.)
  if (
    first === 'manage' &&
    (String(segs[1] || '').toLowerCase() === 'videos' || String(segs[1] || '').toLowerCase() === 'video') &&
    isId(segs[2] || '')
  ) {
    return String(segs[2]);
  }

  // Unlisted Vimeo URLs often look like:
  //   https://vimeo.com/<id>/<hash>
  // where <hash> is a non-numeric token. Treat these as video URLs.
  // This improves provider parity when the URL hasn't been normalized upstream.
  if (segs.length >= 2 && isId(segs[0]) && !isBlocked) {
    const maybeHash = String(segs[1] || '');
    const looksHashy = /^[a-z0-9]+$/i.test(maybeHash) && maybeHash.length >= 6;
    if (looksHashy) return segs[0];
  }

  // Provider parity: unlisted hash segments also appear on collection routes, e.g.:
  //   https://vimeo.com/channels/<name>/<id>/<hash>
  //   https://vimeo.com/groups/<name>/videos/<id>/<hash>
  //   https://player.vimeo.com/video/<id>/<hash>
  // If the path ends with /<id>/<hash>, treat it as a clip URL.
  if (segs.length >= 2 && isId(segs[segs.length - 2]) && !isBlocked) {
    const id = String(segs[segs.length - 2] || '');
    const maybeHash = String(segs[segs.length - 1] || '');
    const looksHashy = /^[a-z0-9]+$/i.test(maybeHash) && maybeHash.length >= 6;
    const isKnownKeyword = /^(?:review|manage|video|videos|channels|groups|album|showcase|advanced)$/i.test(maybeHash);
    if (looksHashy && !isKnownKeyword) return id;
  }

  // Provider parity: Vimeo review links are still clip URLs.
  // Example: https://vimeo.com/<id>/review/<token>/<hash>
  if (segs.length >= 3 && isId(segs[0]) && String(segs[1] || '').toLowerCase() === 'review' && !isBlocked) {
    return String(segs[0]);
  }

  // More general: if the path contains /review/ and the segment before it is a numeric id, treat it as the clip id.
  const reviewIdx = segs.findIndex((x) => String(x || '').toLowerCase() === 'review');
  if (reviewIdx > 0 && isId(segs[reviewIdx - 1]) && !isBlocked) {
    return String(segs[reviewIdx - 1]);
  }

  const isVideoKeyword = (x) => {
    const v = String(x || '').toLowerCase();
    return v === 'video' || v === 'videos';
  };

  // Prefer the last plausible numeric segment.
  // Accept patterns like:
  //  - /<id>
  //  - /channels/<name>/<id>
  //  - /showcase/<id>/video/<id>
  //  - /groups/<name>/videos/<id>
  //  - /album/<id>/video/<id>
  const candidates = [];
  for (let i = 0; i < segs.length; i++) {
    const cur = segs[i];
    if (!isId(cur)) continue;

    const prev = segs[i - 1] || '';
    const isExplicitVideo = isVideoKeyword(prev);
    const isLast = i === segs.length - 1;

    if (isExplicitVideo) {
      candidates.push(cur);
      continue;
    }

    // Allow the final path segment to be an ID for common vimeo.com/<id> URLs,
    // but not on known non-video sections.
    if (isLast && !isBlocked) {
      candidates.push(cur);
    }
  }

  if (!candidates.length) return null;
  return candidates[candidates.length - 1];
}

export function isVimeoUrl(url) {
  return !!extractVimeoId(url);
}

export function isVimeoDomain(url) {
  const s = withScheme(url);
  if (!s) return false;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    return /(^|\.)vimeo\.com$/i.test(host) || host === 'player.vimeo.com';
  } catch {
    return false;
  }
}

// Normalize common Vimeo URL shapes to a canonical clip URL.
//
// Provider parity goals:
//  - Treat player/manage/review/unlisted URLs as the same clip
//  - Preserve the unlisted hash (h=...) when present
//  - Preserve deep-link timestamps (t/start) when present
export function normalizeVimeoUrl(url) {
  const s = withScheme(url);
  if (!s) return '';

  let u;
  try {
    u = new URL(s);
  } catch {
    return String(url || '').trim();
  }

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  const isVimeoHost = /(^|\.)vimeo\.com$/i.test(host) || host === 'player.vimeo.com';
  if (!isVimeoHost) return u.toString();

  const id = extractVimeoId(u.toString());
  if (!id) return u.toString();

  // Provider parity: Some videos are shared via showcases. In those cases the showcase
  // context may be required to access the clip, so preserve the showcase path when present.
  // Example:
  //   https://vimeo.com/showcase/<showcaseId>/video/<videoId>
  // Canonical output:
  //   https://vimeo.com/showcase/<showcaseId>/video/<videoId>?h=...&t=...
  let out;
  try {
    const segs = (u.pathname || '/').split('/').map((x) => x.trim()).filter(Boolean);
    const showcaseIdx = segs.findIndex((x) => String(x || '').toLowerCase() === 'showcase');
    const videoIdx = segs.findIndex((x) => String(x || '').toLowerCase() === 'video');

    const showcaseId = showcaseIdx !== -1 ? String(segs[showcaseIdx + 1] || '').trim() : '';
    const videoId = videoIdx !== -1 ? String(segs[videoIdx + 1] || '').trim() : '';

    const looksVideoId = String(videoId) === String(id);
    if (showcaseId && looksVideoId) {
      out = new URL(`https://vimeo.com/showcase/${encodeURIComponent(showcaseId)}/video/${encodeURIComponent(id)}`);
    } else {
      out = new URL(`https://vimeo.com/${id}`);
    }
  } catch {
    out = new URL(`https://vimeo.com/${id}`);
  }

  // Provider parity: Vimeo "review" links (private review pages) require the review token
  // to access the clip. Preserve the /review/<token>/<hash?> path segments when present.
  // Example inputs:
  //   https://vimeo.com/<id>/review/<token>/<hash>
  //   https://player.vimeo.com/video/<id>/review/<token>/<hash>
  // Canonical output:
  //   https://vimeo.com/<id>/review/<token>/<hash>?h=<hash>&t=...
  // (We still also preserve/normalize the unlisted hash into ?h=... for downstream consistency.)
  try {
    const segs = (u.pathname || '/').split('/').map((x) => x.trim()).filter(Boolean);
    const reviewIdx = segs.findIndex((x) => String(x || '').toLowerCase() === 'review');
    if (reviewIdx !== -1) {
      const token = String(segs[reviewIdx + 1] || '').trim();
      const maybeHash = String(segs[reviewIdx + 2] || '').trim();
      // Keep this conservative: token must exist; hash is optional.
      if (token) {
        out.pathname = `/${id}/review/${encodeURIComponent(token)}${maybeHash ? `/${encodeURIComponent(maybeHash)}` : ''}`;
      }
    }
  } catch {
    // ignore
  }

  // Unlisted videos: Vimeo commonly uses either:
  //  - https://vimeo.com/<id>/<hash>
  //  - https://vimeo.com/<id>?h=<hash>
  // Preserve/convert into ?h=... form.
  const existingH = u.searchParams.get('h') || '';
  let hashToken = existingH;

  if (!hashToken) {
    const segs = (u.pathname || '/').split('/').map((x) => x.trim()).filter(Boolean);

    // /<id>/<hash>
    if (segs.length >= 2 && String(segs[0]) === String(id)) {
      const maybe = String(segs[1] || '');
      const looksHashy = /^[a-z0-9]+$/i.test(maybe) && maybe.length >= 6;
      const isKnownKeyword = /^(?:review|manage|video|videos|channels|groups|album|showcase|advanced)$/i.test(maybe);
      if (looksHashy && !isKnownKeyword) {
        hashToken = maybe;
      }
    }

    // Provider parity: unlisted hashes also show up on non-root clip routes, e.g.:
    //  - https://player.vimeo.com/video/<id>/<hash>
    //  - https://vimeo.com/channels/<name>/<id>/<hash>
    // Find any "<id>/<hash>" pair in the path and convert it to ?h=...
    if (!hashToken) {
      for (let i = 0; i < segs.length - 1; i++) {
        if (String(segs[i]) !== String(id)) continue;
        const maybe = String(segs[i + 1] || '');
        const looksHashy = /^[a-z0-9]+$/i.test(maybe) && maybe.length >= 6;
        const isKnownKeyword = /^(?:review|manage|video|videos|channels|groups|album|showcase|advanced)$/i.test(maybe);
        if (looksHashy && !isKnownKeyword) {
          hashToken = maybe;
          break;
        }
      }
    }

    // Review URLs may include a token segment and a hash segment; the final segment is often the unlisted hash.
    if (!hashToken) {
      const reviewIdx = segs.findIndex((x) => String(x || '').toLowerCase() === 'review');
      if (reviewIdx !== -1 && segs.length >= reviewIdx + 3) {
        const last = String(segs[segs.length - 1] || '');
        const looksHashy = /^[a-z0-9]+$/i.test(last) && last.length >= 6;
        if (looksHashy) hashToken = last;
      }
    }
  }

  if (hashToken) out.searchParams.set('h', hashToken);

  // Preserve deep-link timestamps.
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

// Some Vimeo URLs are not directly extractable as videos (events/blog/etc).
// Return a short actionable reason when we can detect this.
export function vimeoNonVideoReason(url) {
  const s = withScheme(url);
  if (!s) return '';

  let u;
  try {
    u = new URL(s);
  } catch {
    return '';
  }

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  if (!/(^|\.)vimeo\.com$/i.test(host)) return '';

  const segs = (u.pathname || '/')
    .split('/')
    .map((x) => x.trim())
    .filter(Boolean);

  const first = (segs[0] || '').toLowerCase();
  if (first === 'event' || first === 'events') {
    return 'Vimeo event pages are not supported. Open the event and copy the actual video URL (typically https://vimeo.com/<id> or https://player.vimeo.com/video/<id>).';
  }

  if (first === 'blog') {
    return 'Vimeo blog pages are not supported. Open the embedded video and copy its Vimeo clip URL (https://vimeo.com/<id>).';
  }

  // Provider parity: Vimeo on-demand pages usually do not contain a stable numeric clip id in the URL.
  // Ask the user to open the player and copy the actual clip URL instead.
  if (first === 'ondemand') {
    return 'Vimeo on-demand pages are not supported. Open the video player and copy the actual Vimeo clip URL (typically https://vimeo.com/<id> or https://player.vimeo.com/video/<id>).';
  }

  if (first === 'showcase' && !/\/video\/\d+\b/i.test(u.pathname || '')) {
    return 'Vimeo showcase pages are not supported. Open the showcase video and copy the actual clip URL (https://vimeo.com/<id> or https://vimeo.com/showcase/<showcaseId>/video/<videoId>).';
  }

  return '';
}

function cleanCaptionText(s) {
  let v = String(s || '');
  if (!v) return '';

  // Strip lightweight caption markup (common in Vimeo transcript JSON too).
  v = v.replace(/<[^>]+>/g, '');

  // Decode a small deterministic set of common entities.
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

export function parseVimeoTranscript(body) {
  const raw = String(body || '');
  if (!raw.trim()) return '';

  // If it's VTT (or looks like it), parse as VTT.
  if (/^\s*WEBVTT\b/i.test(raw) || /\d{2}:\d{2}(?::\d{2})?\.\d{3}\s*-->\s*\d{2}:\d{2}(?::\d{2})?\.\d{3}/.test(raw)) {
    return parseSimpleVtt(raw);
  }

  // Vimeo transcript JSON has shown up in multiple shapes. Be generous.
  try {
    const json = JSON.parse(raw);

    const candidates = [
      Array.isArray(json) ? json : null,
      Array.isArray(json?.transcript) ? json.transcript : null,
      Array.isArray(json?.captions) ? json.captions : null,
      Array.isArray(json?.cues) ? json.cues : null,
      Array.isArray(json?.subtitles) ? json.subtitles : null,
      Array.isArray(json?.entries) ? json.entries : null,
      Array.isArray(json?.data?.transcript) ? json.data.transcript : null,
      Array.isArray(json?.data?.captions) ? json.data.captions : null,
    ].filter((x) => Array.isArray(x) && x.length);

    const items = candidates[0] || [];

    const parsed = items
      .map((it, idx) => {
        if (typeof it === 'string') return { idx, start: null, text: cleanCaptionText(it) };

        const rawText =
          it?.text ||
          it?.caption ||
          it?.line ||
          it?.value ||
          (typeof it?.content === 'string' ? it.content : '') ||
          it?.content?.text ||
          it?.data?.text ||
          it?.payload?.text ||
          '';

        const startRaw =
          it?.start ??
          it?.startTime ??
          it?.begin ??
          it?.time ??
          it?.timestamp ??
          it?.data?.start ??
          it?.data?.startTime ??
          it?.payload?.start ??
          it?.payload?.startTime ??
          null;

        const start = startRaw == null ? null : Number(startRaw);
        return {
          idx,
          start: Number.isFinite(start) ? start : null,
          text: cleanCaptionText(rawText),
        };
      })
      .filter((x) => Boolean(x.text));

    const hasAnyStart = parsed.some((x) => x.start != null);
    if (hasAnyStart) {
      // Some Vimeo transcript/cue endpoints don't guarantee ordering.
      // If we have start times, sort by time; otherwise preserve input order.
      parsed.sort((a, b) => {
        if (a.start == null && b.start == null) return a.idx - b.idx;
        if (a.start == null) return 1;
        if (b.start == null) return -1;
        if (a.start !== b.start) return a.start - b.start;
        return a.idx - b.idx;
      });
    }

    const formatTime = (seconds) => {
      const s = Math.floor(Number(seconds) || 0);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const r = s % 60;
      if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
      return `${m}:${String(r).padStart(2, '0')}`;
    };

    // Provider parity: when we have cue start times, keep them.
    // This matches Loom behavior and makes downstream briefs more actionable.
    if (hasAnyStart) {
      return parsed
        .map((x) => `${formatTime(x.start ?? 0)} ${x.text}`)
        .join('\n')
        .trim();
    }

    return parsed
      .map((x) => x.text)
      .join(' ')
      .trim();
  } catch {
    // fall through
  }

  // Unknown format: treat as plain text.
  return raw.trim();
}

export async function fetchVimeoOembed(url) {
  try {
    const u = new URL('https://vimeo.com/api/oembed.json');
    u.searchParams.set('url', String(url || ''));

    const res = await fetch(u.toString(), {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function pickBestProgressive(progressive = []) {
  if (!Array.isArray(progressive) || progressive.length === 0) return null;
  return [...progressive].sort((a, b) => Number(b.width || 0) - Number(a.width || 0))[0];
}

function pickBestTextTrack(textTracks = []) {
  if (!Array.isArray(textTracks) || textTracks.length === 0) return null;

  const norm = (t) => {
    const lang = String(t?.lang || '').toLowerCase();
    const name = String(t?.name || '').toLowerCase();
    const url = String(t?.url || '');

    const isEn = lang.startsWith('en');
    const isAuto = name.includes('auto') || name.includes('automatic') || name.includes('asr');
    // Vimeo text track URLs are sometimes direct .vtt files, but can also be served from
    // endpoints like /texttrack?format=vtt (no .vtt extension). Treat both as VTT.
    const isDirectVtt = /\.vtt(?:\?|#|$)/i.test(url);
    const isVttParam = /[?&](?:format|fmt)=vtt(?:&|$)/i.test(url);
    const isVtt = isDirectVtt || isVttParam;

    // Higher is better.
    // Prefer English, prefer non-auto tracks, prefer VTT (most consistent parser/quality).
    // Prefer a direct .vtt asset over an endpoint that serves VTT via query params.
    const vttScore = isDirectVtt ? 3 : isVtt ? 2 : 0;
    const score = (isEn ? 100 : 0) + (isAuto ? 0 : 10) + vttScore;

    return { t, score };
  };

  return [...textTracks]
    .map(norm)
    .sort((a, b) => b.score - a.score)[0]?.t || null;
}

function pickBestHlsUrl(hls) {
  // Vimeo clip_page_config may include HLS manifests at:
  //   request.files.hls.default_cdn + request.files.hls.cdns[cdn].url
  // We prefer the default_cdn if present, otherwise the first CDN entry.
  const cdns = hls?.cdns;
  if (!cdns || typeof cdns !== 'object') return '';

  const defaultKey = typeof hls?.default_cdn === 'string' ? hls.default_cdn : '';
  const preferred = defaultKey && cdns[defaultKey] ? cdns[defaultKey] : null;
  const first = preferred || cdns[Object.keys(cdns)[0] || ''] || null;
  const url = typeof first?.url === 'string' ? first.url : '';
  return url;
}

function normalizeVimeoAssetUrl(url, base = 'https://vimeo.com') {
  const v = String(url || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith('//')) return `https:${v}`;
  if (v.startsWith('/')) return `${base}${v}`;
  return v;
}

function ensureVimeoVtt(url) {
  let raw = String(url || '').trim();
  if (!raw) return '';

  // Normalize protocol-relative inputs so URL parsing works.
  if (raw.startsWith('//')) raw = `https:${raw}`;

  // If it's already a direct VTT asset or explicitly requests VTT, keep as-is.
  if (/\.vtt(?:\?|#|$)/i.test(raw)) return raw;
  if (/[?&](?:format|fmt)=vtt(?:&|$)/i.test(raw)) return raw;

  // Vimeo sometimes serves captions from /texttrack/... endpoints.
  // Force VTT for consistent downstream parsing.
  if (!/\/texttrack\b/i.test(raw)) return raw;

  try {
    const u = new URL(raw);
    u.searchParams.set('format', 'vtt');
    return u.toString();
  } catch {
    const sep = raw.includes('?') ? '&' : '?';
    return `${raw}${sep}format=vtt`;
  }
}

function extractBalancedJsonObject(source, startIndex) {
  // startIndex must point at '{'
  let depth = 0;
  let inStr = false;
  let strQuote = '';
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
      if (ch === strQuote) {
        inStr = false;
        strQuote = '';
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inStr = true;
      strQuote = ch;
      continue;
    }

    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(startIndex, i + 1);
      }
    }
  }
  return '';
}

export function extractVimeoMetadataFromHtml(html) {
  const h = String(html || '');
  if (!h.trim()) return null;

  // Meta-only fallback (tests expect this)
  const ogTitle = h.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']*)["'][^>]*>/i)?.[1];
  const ogDesc = h.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']*)["'][^>]*>/i)?.[1];

  // Find the start of the JSON object assigned to clip_page_config.
  const idx = h.search(/clip_page_config\s*=\s*\{/i);
  if (idx === -1) {
    if (ogTitle || ogDesc) {
      return {
        title: ogTitle || undefined,
        description: ogDesc || undefined,
      };
    }
    return null;
  }

  const brace = h.indexOf('{', idx);
  if (brace === -1) return null;

  const obj = extractBalancedJsonObject(h, brace);
  const cfg = obj ? safeJsonParse(obj) : null;
  if (!cfg || typeof cfg !== 'object') return null;

  const title = cfg?.clip?.name || '';
  const duration = cfg?.clip?.duration?.raw != null ? Number(cfg.clip.duration.raw) : undefined;
  const thumbnailUrl = cfg?.clip?.poster?.display_src || undefined;
  const author = cfg?.owner?.display_name || undefined;

  const progressive = cfg?.request?.files?.progressive || [];
  const best = pickBestProgressive(progressive);

  // Prefer direct MP4 URLs when available, but fall back to HLS manifests.
  // This improves parity with providers like Fathom/Loom where we often have a stream URL.
  const hlsUrl = pickBestHlsUrl(cfg?.request?.files?.hls);
  const mediaUrl = normalizeVimeoAssetUrl(best?.url || hlsUrl) || undefined;

  const tt = pickBestTextTrack(cfg?.request?.text_tracks || []);
  const transcriptUrl = normalizeVimeoAssetUrl(ensureVimeoVtt(tt?.url)) || undefined;

  // Description: prefer og:description (most reliable), otherwise fall back to config clip description.
  // Vimeo has used a few shapes over time:
  //  - clip.description (string)
  //  - clip.description.text (string)
  const cfgDesc =
    (typeof cfg?.clip?.description === 'string' ? cfg.clip.description : '') ||
    (typeof cfg?.clip?.description?.text === 'string' ? cfg.clip.description.text : '');

  const description = ogDesc || cfgDesc || '';

  return {
    title: title || undefined,
    description: description || undefined,
    duration,
    thumbnailUrl,
    author,
    mediaUrl,
    transcriptUrl,
  };
}

// Provider parity: dedicated transcript URL extraction (similar to Fathom's extractFathomTranscriptUrl)
// Extracts the best caption track URL from Vimeo HTML by scanning clip_page_config.
export function extractVimeoTranscriptUrl(html) {
  const meta = extractVimeoMetadataFromHtml(html);
  return meta?.transcriptUrl || null;
}

// Provider parity: fetch media URL for Vimeo videos (similar to fetchYoutubeMediaUrl)
// Fetches the Vimeo page and extracts the direct video URL from clip_page_config.
export async function fetchVimeoMediaUrl(url) {
  try {
    const normalized = normalizeVimeoUrl(String(url || ''));
    if (!normalized) return null;

    const res = await fetch(normalized, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      // Provide a clear error for different HTTP status codes
      if (res.status === 401) {
        throw new Error('Vimeo video is private or requires authentication. Use --cookie to provide your session cookies.');
      }
      if (res.status === 404) {
        throw new Error('Vimeo video not found. The link may be invalid, the video has been removed, or the account is disabled.');
      }
      if (res.status === 403) {
        throw new Error('Vimeo video is not available for download. It may be geo-blocked, restricted, or require a subscription.');
      }
      if (res.status >= 500) {
        throw new Error(`Vimeo server error (${res.status}). Please try again later.`);
      }
      return null;
    }

    const html = await res.text();
    const meta = extractVimeoMetadataFromHtml(html);
    return meta?.mediaUrl || null;
  } catch (err) {
    // Re-throw with context for the caller to provide helpful errors
    throw err;
  }
}
