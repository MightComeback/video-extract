import ytdl from 'ytdl-core';

function cleanUrlInput(url) {
  let s = String(url || '').trim();
  if (!s) return '';

  // Provider parity: HTML copy/paste often escapes query separators.
  // Example: https://youtube.com/watch?v=...&amp;t=30
  s = s.replace(/&amp;/gi, '&').replace(/&#0*38;/gi, '&');

  // Provider parity: accept angle-wrapped links (common in markdown/chat), including Slack-style <url|label>.
  const slack = s.match(/^<\s*([^|>\s]+)\s*\|[^>]*>$/i);
  if (slack) s = String(slack[1] || '').trim();
  const angle = s.match(/^<\s*([^>\s]+)\s*>$/i);
  if (angle) s = String(angle[1] || '').trim();

  // Provider parity: URLs pasted in chat are often wrapped or followed by punctuation.
  // Examples:
  //  - (https://youtu.be/<id>?t=43).
  //  - https://youtube.com/watch?v=<id>,
  // Be conservative: only strip common trailing punctuation characters.
  const unwrap = [
    [/^\((.*)\)$/, 1],
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

  for (let i = 0; i < 3; i++) {
    const last = s.slice(-1);
    if (!last) break;
    if (!['.', ',', ';', '!', '?', ')', ']', '}'].includes(last)) break;
    s = s.slice(0, -1).trim();
  }

  return s;
}

export function extractYoutubeId(url) {
  const s = cleanUrlInput(url);
  if (!s) return null;

  // Ensure we can parse even if the user omitted scheme.
  // Also accept protocol-relative URLs like "//youtube.com/watch?v=...".
  const withScheme = /^(?:https?:)?\/\//i.test(s)
    ? (s.startsWith('//') ? `https:${s}` : s)
    : `https://${s}`;

  let u;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    return /^[a-zA-Z0-9_-]{11}$/.test(id || '') ? id : null;
  }

  // Accept youtube.com subdomains (m., music., etc) and youtube-nocookie.com embeds.
  if (!/(^|\.)youtube\.com$/i.test(host) && !/(^|\.)youtube-nocookie\.com$/i.test(host)) return null;

  // /redirect?q=<encoded-url> (common when copying external links from YouTube descriptions)
  // Example:
  //   https://www.youtube.com/redirect?q=https%3A%2F%2Fyoutu.be%2F<id>%3Ft%3D43
  if (u.pathname.toLowerCase() === '/redirect') {
    const encoded = u.searchParams.get('q') || u.searchParams.get('url');
    if (encoded) {
      try {
        let decoded = encoded;
        for (let i = 0; i < 2; i++) {
          if (!/%[0-9a-fA-F]{2}/.test(decoded)) break;
          decoded = decodeURIComponent(decoded);
        }
        const id = extractYoutubeId(decoded);
        if (id) return id;
      } catch {
        // ignore
      }
    }
  }

  // /attribution_link?...&u=/watch%3Fv%3D<id>%26...
  // These are common when sharing from mobile apps.
  if (u.pathname.toLowerCase() === '/attribution_link') {
    const encoded = u.searchParams.get('u');
    if (encoded) {
      try {
        // Some shares double-encode the inner URL/path (e.g. %252Fwatch%253Fv%253D...).
        // Decode up to 2 times to be resilient.
        let decoded = encoded;
        for (let i = 0; i < 2; i++) {
          // Only attempt another decode when it still looks encoded.
          if (!/%[0-9a-fA-F]{2}/.test(decoded)) break;
          decoded = decodeURIComponent(decoded);
        }

        const inner = decoded.startsWith('http')
          ? decoded
          : `https://youtube.com${decoded.startsWith('/') ? '' : '/'}${decoded}`;
        const id = extractYoutubeId(inner);
        if (id) return id;
      } catch {
        // ignore
      }
    }
  }

  // watch?v=<id>
  const v = u.searchParams.get('v');
  if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

  // Provider parity: some share flows or intermediate redirects produce URLs like:
  //   https://www.youtube.com/watch/<id>
  // Treat these as direct video URLs too.
  const watchPath = u.pathname.match(/^\/watch\/([a-zA-Z0-9_-]{11})\b/);
  if (watchPath) return watchPath[1];

  // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
  // Also accept handle-based URLs like:
  //   /@SomeChannel/shorts/<id>
  //   /@SomeChannel/live/<id>
  const m = u.pathname.match(/\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})\b/);
  if (m) return m[1];

  const mHandle = u.pathname.match(/\/@[^/]+\/(?:shorts|live)\/([a-zA-Z0-9_-]{11})\b/);
  if (mHandle) return mHandle[1];

  return null;
}

export function isYoutubeDomain(url) {
  const s = cleanUrlInput(url);
  if (!s) return false;

  const withScheme = /^(?:https?:)?\/\//i.test(s)
    ? (s.startsWith('//') ? `https:${s}` : s)
    : `https://${s}`;

  let u;
  try {
    u = new URL(withScheme);
  } catch {
    return false;
  }

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  return /(^|\.)youtube\.com$/i.test(host) || /(^|\.)youtube-nocookie\.com$/i.test(host) || host === 'youtu.be';
}

// Normalize common YouTube share URLs to a canonical /watch?v=... form.
// Keeps query params (t/start/si/etc) so downstream logic can preserve timestamps.
export function normalizeYoutubeUrl(url) {
  const s = cleanUrlInput(url);
  if (!s) return '';

  const withScheme = /^(?:https?:)?\/\//i.test(s)
    ? (s.startsWith('//') ? `https:${s}` : s)
    : `https://${s}`;

  let u;
  try {
    u = new URL(withScheme);
  } catch {
    return s;
  }

  // Provider parity: YouTube share links sometimes put timestamps in the hash fragment
  // (e.g. https://youtu.be/<id>#t=1m2s). Normalize those into query params so downstream
  // logic can preserve them consistently.
  const hashTime = (() => {
    const hash = String(u.hash || '').replace(/^#/, '').trim();
    if (!hash) return '';
    const hp = new URLSearchParams(hash);
    return hp.get('t') || hp.get('start') || hp.get('time_continue') || '';
  })();

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();

  // /redirect?q=<encoded-url> (common when copying external links from YouTube descriptions)
  if (u.pathname.toLowerCase() === '/redirect') {
    const encoded = u.searchParams.get('q') || u.searchParams.get('url');
    if (encoded) {
      try {
        let decoded = encoded;
        for (let i = 0; i < 2; i++) {
          if (!/%[0-9a-fA-F]{2}/.test(decoded)) break;
          decoded = decodeURIComponent(decoded);
        }
        const out = normalizeYoutubeUrl(decoded);
        if (out) return out;
      } catch {
        // ignore
      }
    }
    // If we can't decode it, fall through to canonicalization of the current URL.
  }

  // /attribution_link?...&u=/watch%3Fv%3D<id>%26...
  // Common when sharing from mobile apps.
  if (u.pathname.toLowerCase() === '/attribution_link') {
    const encoded = u.searchParams.get('u');
    if (encoded) {
      try {
        // Some shares double-encode the inner URL/path (e.g. %252Fwatch%253Fv%253D...).
        // Decode up to 2 times to be resilient.
        let decoded = encoded;
        for (let i = 0; i < 2; i++) {
          if (!/%[0-9a-fA-F]{2}/.test(decoded)) break;
          decoded = decodeURIComponent(decoded);
        }

        const inner = decoded.startsWith('http')
          ? decoded
          : `https://youtube.com${decoded.startsWith('/') ? '' : '/'}${decoded}`;

        // Re-enter normalization on the inner URL.
        const out = normalizeYoutubeUrl(inner);
        if (out) return out;
      } catch {
        // ignore
      }
    }
  }

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    if (/^[a-zA-Z0-9_-]{11}$/.test(id || '')) {
      const out = new URL('https://www.youtube.com/watch');
      out.searchParams.set('v', id);
      for (const [k, v] of u.searchParams.entries()) out.searchParams.set(k, v);
      if (hashTime && !out.searchParams.has('t') && !out.searchParams.has('start') && !out.searchParams.has('time_continue')) {
        out.searchParams.set('t', hashTime);
      }
      return out.toString();
    }
  }

  // /@Channel/shorts/<id> (common when sharing from a channel profile)
  const handleShorts = u.pathname.match(/^\/@[^/]+\/shorts\/([^/?#]+)/);
  if (/^[a-zA-Z0-9_-]{11}$/.test(handleShorts?.[1] || '')) {
    const out = new URL('https://www.youtube.com/watch');
    out.searchParams.set('v', handleShorts[1]);
    for (const [k, v] of u.searchParams.entries()) out.searchParams.set(k, v);
    if (hashTime && !out.searchParams.has('t') && !out.searchParams.has('start') && !out.searchParams.has('time_continue')) {
      out.searchParams.set('t', hashTime);
    }
    return out.toString();
  }

  // /shorts/<id>
  const shorts = u.pathname.match(/^\/shorts\/([^/?#]+)/);
  if (/^[a-zA-Z0-9_-]{11}$/.test(shorts?.[1] || '')) {
    const out = new URL('https://www.youtube.com/watch');
    out.searchParams.set('v', shorts[1]);
    for (const [k, v] of u.searchParams.entries()) out.searchParams.set(k, v);
    if (hashTime && !out.searchParams.has('t') && !out.searchParams.has('start') && !out.searchParams.has('time_continue')) {
      out.searchParams.set('t', hashTime);
    }
    return out.toString();
  }

  // /@Channel/live/<id>
  const handleLive = u.pathname.match(/^\/@[^/]+\/live\/([^/?#]+)/);
  if (/^[a-zA-Z0-9_-]{11}$/.test(handleLive?.[1] || '')) {
    const out = new URL('https://www.youtube.com/watch');
    out.searchParams.set('v', handleLive[1]);
    for (const [k, v] of u.searchParams.entries()) out.searchParams.set(k, v);
    if (hashTime && !out.searchParams.has('t') && !out.searchParams.has('start') && !out.searchParams.has('time_continue')) {
      out.searchParams.set('t', hashTime);
    }
    return out.toString();
  }

  // /live/<id>
  const live = u.pathname.match(/^\/live\/([^/?#]+)/);
  if (/^[a-zA-Z0-9_-]{11}$/.test(live?.[1] || '')) {
    const out = new URL('https://www.youtube.com/watch');
    out.searchParams.set('v', live[1]);
    for (const [k, v] of u.searchParams.entries()) out.searchParams.set(k, v);
    if (hashTime && !out.searchParams.has('t') && !out.searchParams.has('start') && !out.searchParams.has('time_continue')) {
      out.searchParams.set('t', hashTime);
    }
    return out.toString();
  }

  // /v/<id> (old embed-style URLs)
  const vPath = u.pathname.match(/^\/v\/([^/?#]+)/);
  if (/^[a-zA-Z0-9_-]{11}$/.test(vPath?.[1] || '')) {
    const out = new URL('https://www.youtube.com/watch');
    out.searchParams.set('v', vPath[1]);
    for (const [k, v] of u.searchParams.entries()) out.searchParams.set(k, v);
    if (hashTime && !out.searchParams.has('t') && !out.searchParams.has('start') && !out.searchParams.has('time_continue')) {
      out.searchParams.set('t', hashTime);
    }
    return out.toString();
  }

  // /watch/<id>
  const watchPath = u.pathname.match(/^\/watch\/([^/?#]+)/);
  if (/^[a-zA-Z0-9_-]{11}$/.test(watchPath?.[1] || '')) {
    const out = new URL('https://www.youtube.com/watch');
    out.searchParams.set('v', watchPath[1]);
    for (const [k, v] of u.searchParams.entries()) out.searchParams.set(k, v);
    if (hashTime && !out.searchParams.has('t') && !out.searchParams.has('start') && !out.searchParams.has('time_continue')) {
      out.searchParams.set('t', hashTime);
    }
    return out.toString();
  }

  // /embed/<id>
  const embed = u.pathname.match(/^\/embed\/([^/?#]+)/);
  if (/^[a-zA-Z0-9_-]{11}$/.test(embed?.[1] || '')) {
    const out = new URL('https://www.youtube.com/watch');
    out.searchParams.set('v', embed[1]);
    for (const [k, v] of u.searchParams.entries()) out.searchParams.set(k, v);
    if (hashTime && !out.searchParams.has('t') && !out.searchParams.has('start') && !out.searchParams.has('time_continue')) {
      out.searchParams.set('t', hashTime);
    }
    return out.toString();
  }

  // Canonicalize all YouTube hosts to a stable output for provider parity.
  // (m.youtube.com, music.youtube.com, youtube-nocookie.com, etc.)
  if (/(^|\.)youtube\.com$/i.test(host) || /(^|\.)youtube-nocookie\.com$/i.test(host)) {
    u.protocol = 'https:';
    u.hostname = 'www.youtube.com';
  }

  if (hashTime && !u.searchParams.has('t') && !u.searchParams.has('start') && !u.searchParams.has('time_continue')) {
    u.searchParams.set('t', hashTime);
  }
  // Avoid leaking arbitrary hash fragments into canonical URLs.
  u.hash = '';

  return u.toString();
}

export function youtubeNonVideoReason(url) {
  const s = cleanUrlInput(url);
  if (!s) return '';

  const withScheme = /^(?:https?:)?\/\//i.test(s)
    ? (s.startsWith('//') ? `https:${s}` : s)
    : `https://${s}`;

  let u;
  try {
    u = new URL(withScheme);
  } catch {
    return '';
  }

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  if (!/(^|\.)youtube\.com$/i.test(host) && !/(^|\.)youtube-nocookie\.com$/i.test(host) && host !== 'youtu.be') return '';

  const path = String(u.pathname || '').toLowerCase();

  // If it already looks like a clip or a direct video URL, don't flag it here.
  // BUT: /watch without a valid v=... param is very common (copying the wrong URL),
  // and it's better to surface a clear actionable error than to attempt a fetch.
  if (path.startsWith('/watch')) {
    const v = String(u.searchParams.get('v') || '').trim();
    const valid = /^[a-zA-Z0-9_-]{11}$/.test(v);
    if (!valid) {
      return 'This YouTube URL does not appear to be a direct video link. Please provide a direct video URL like https://youtube.com/watch?v=... instead.';
    }
    return '';
  }

  if (
    path.startsWith('/shorts/') ||
    path.startsWith('/embed/') ||
    path.startsWith('/live/') ||
    path.startsWith('/v/') ||
    path.startsWith('/clip/')
  ) {
    return '';
  }

  // Playlists: /playlist?list=... (no video id)
  if (path === '/playlist' && (u.searchParams.get('list') || '')) {
    return 'YouTube playlist URLs are not supported. Please provide a direct video URL like https://youtube.com/watch?v=... instead.';
  }

  // Channels / handles / user pages.
  if (path.startsWith('/channel/') || path.startsWith('/@') || path.startsWith('/c/') || path.startsWith('/user/')) {
    return 'YouTube channel/handle URLs are not supported. Please provide a direct video URL like https://youtube.com/watch?v=... instead.';
  }

  // Other common non-video routes.
  if (path.startsWith('/feed') || path.startsWith('/results') || path.startsWith('/hashtag/') || path.startsWith('/signin')) {
    return 'This YouTube URL does not appear to be a direct video link. Please provide a direct video URL like https://youtube.com/watch?v=... instead.';
  }

  return '';
}

export function isYoutubeClipUrl(url) {
  const s = cleanUrlInput(url);
  if (!s) return false;

  // Ensure we can parse even if the user omitted scheme.
  // Also accept protocol-relative URLs like "//youtube.com/clip/...".
  const withScheme = /^(?:https?:)?\/\//i.test(s)
    ? (s.startsWith('//') ? `https:${s}` : s)
    : `https://${s}`;

  let u;
  try {
    u = new URL(withScheme);
  } catch {
    return false;
  }

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();

  // Accept youtube.com subdomains (m., music., etc) for clip URLs too.
  // Clips do not contain a stable 11-char video id without an additional fetch.
  if (!/(^|\.)youtube\.com$/i.test(host)) return false;

  // YouTube clip links look like:
  //   https://www.youtube.com/clip/<clipId>
  return /^\/clip\//i.test(u.pathname || '');
}

export function isYoutubeUrl(url) {
  return !!extractYoutubeId(url);
}

// YouTube clip pages (youtube.com/clip/<clipId>) do not include a stable 11-char video id in the URL,
// but the underlying watch video id is often present in the HTML payload.
// This helper enables best-effort resolution so clip links can be treated like normal watch URLs.
export function extractYoutubeIdFromClipHtml(html) {
  const h = String(html || '');
  if (!h.trim()) return null;

  // Common payload shapes include JSON with "videoId":"<id>".
  const m1 = h.match(/\"videoId\"\s*:\s*\"(?<id>[a-zA-Z0-9_-]{11})\"/);
  if (m1?.groups?.id) return m1.groups.id;

  const m2 = h.match(/"videoId"\s*:\s*"(?<id>[a-zA-Z0-9_-]{11})"/);
  if (m2?.groups?.id) return m2.groups.id;

  // Clip pages sometimes only expose the id inside a nested watchEndpoint payload.
  // Be resilient to nested objects/newlines inside the watchEndpoint object.
  const mWatch = h.match(/"watchEndpoint"\s*:\s*\{[\s\S]*?"videoId"\s*:\s*"(?<id>[a-zA-Z0-9_-]{11})"/);
  if (mWatch?.groups?.id) return mWatch.groups.id;

  // Fallback: sometimes the canonical watch URL is embedded.
  const m3 = h.match(/watch\?v=(?<id>[a-zA-Z0-9_-]{11})\b/);
  if (m3?.groups?.id) return m3.groups.id;

  // Provider parity: clip pages sometimes expose the underlying watch URL via
  // a canonicalBaseUrl field (often JSON-escaped), e.g.:
  //   "canonicalBaseUrl":"\/watch?v=<id>"
  // Handle both escaped and unescaped forms.
  const m4 = h.match(/canonicalBaseUrl\"\s*:\s*\"(?:\\\/)?watch\?v=(?<id>[a-zA-Z0-9_-]{11})\b/);
  if (m4?.groups?.id) return m4.groups.id;

  return null;
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function pickBestCaptionTrack(tracks = []) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;

  // Manual captions usually omit kind or have kind==='standard'; auto-generated have kind==='asr'.
  // Prefer:
  //  1) English manual
  //  2) English ASR
  //  3) First track
  const isEnglish = (t) => String(t?.languageCode || '').toLowerCase().startsWith('en');
  const isAsr = (t) => String(t?.kind || '').toLowerCase() === 'asr';

  const english = tracks.filter(isEnglish);
  const englishManual = english.find((t) => !isAsr(t));
  if (englishManual) return englishManual;

  const englishAsr = english.find(isAsr);
  if (englishAsr) return englishAsr;

  return tracks[0];
}

function ensureVtt(baseUrl) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return '';

  // If there's already a fmt=vtt, keep as-is.
  if (/\bfmt=vtt\b/i.test(raw)) return raw;

  // Prefer URL parsing so we can *replace* an existing fmt=... cleanly.
  try {
    const u = new URL(raw);
    u.searchParams.set('fmt', 'vtt');
    return u.toString();
  } catch {
    // Fall back to string manipulation for non-absolute URLs.
    if (/([?&])fmt=[^&]+/i.test(raw)) {
      return raw.replace(/([?&])fmt=[^&]+/i, '$1fmt=vtt');
    }

    // If it doesn't have any query params, use '?' instead of '&'.
    const sep = raw.includes('?') ? '&' : '?';
    return `${raw}${sep}fmt=vtt`;
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

export function extractYoutubeMetadataFromHtml(html) {
  const h = String(html || '');
  if (!h.trim()) return {};

  const idx = h.search(/(?:var\s+ytInitialPlayerResponse\s*=\s*|window\["ytInitialPlayerResponse"\]\s*=\s*|window\['ytInitialPlayerResponse'\]\s*=\s*)\{/i);
  if (idx === -1) return {};

  const brace = h.indexOf('{', idx);
  if (brace === -1) return {};

  const obj = extractBalancedJsonObject(h, brace);
  const data = obj ? safeJsonParse(obj) : null;
  if (!data || typeof data !== 'object') return {};

  const vd = data.videoDetails || {};
  const title = vd.title || '';
  const description = vd.shortDescription || '';
  const author = vd.author || '';
  const duration = vd.lengthSeconds != null ? Number(vd.lengthSeconds) : null;
  const channelId = vd.channelId || '';
  const viewCount = vd.viewCount != null ? Number(vd.viewCount) : undefined;
  const isLive = vd.isLiveContent != null ? Boolean(vd.isLiveContent) : undefined;

  const date =
    vd.publishDate ||
    vd.uploadDate ||
    data?.microformat?.playerMicroformatRenderer?.publishDate ||
    data?.microformat?.playerMicroformatRenderer?.uploadDate ||
    undefined;

  // Thumbnail: pick the largest (often last).
  let thumbnailUrl = '';
  const thumbs = vd.thumbnail?.thumbnails;
  if (Array.isArray(thumbs) && thumbs.length) {
    const best = [...thumbs].sort((a, b) => (Number(b.width || 0) - Number(a.width || 0)))[0];
    thumbnailUrl = best?.url || '';
  }

  // Captions
  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const track = pickBestCaptionTrack(tracks);
  const transcriptUrl = track?.baseUrl ? ensureVtt(track.baseUrl) : '';

  return {
    title: title || undefined,
    description: description || undefined,
    author: author || undefined,
    duration: Number.isFinite(duration) ? duration : undefined,
    channelId: channelId || undefined,
    thumbnailUrl: thumbnailUrl || undefined,
    transcriptUrl: transcriptUrl || undefined,
    viewCount,
    isLive,
    date: date || undefined,
  };
}

export async function fetchYoutubeOembed(url) {
  try {
    // For parity with other normalization logic, we call oEmbed with a stable, non-www watch URL.
    // (Some tests and downstream tooling expect youtube.com here.)
    let target = String(url || '');
    try {
      const parsed = new URL(target);
      parsed.protocol = 'https:';
      parsed.hostname = parsed.hostname.replace(/^www\./i, '');
      target = parsed.toString();
    } catch {
      // ignore; best-effort only
    }

    const u = new URL('https://www.youtube.com/oembed');
    u.searchParams.set('url', target);
    u.searchParams.set('format', 'json');

    const res = await fetch(u.toString(), {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchYoutubeMediaUrl(url) {
  try {
    const info = await ytdl.getInfo(String(url || ''));

    // Prefer a progressive MP4 where possible.
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highest',
      filter: (f) => {
        // Prefer formats with both audio and video when possible (simpler download).
        if (!f) return false;
        if (f.container !== 'mp4') return false;
        return Boolean(f.hasVideo) && Boolean(f.hasAudio) && Boolean(f.url);
      },
    });

    return format?.url || null;
  } catch {
    return null;
  }
}
