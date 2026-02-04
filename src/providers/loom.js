import { parseSimpleVtt } from '../utils.js';

function withScheme(s) {
  const v = String(s || '').trim();
  if (!v) return '';

  // Accept protocol-relative URLs like "//loom.com/share/...".
  if (v.startsWith('//')) return `https:${v}`;

  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

export function isLoomUrl(url) {
  return !!extractLoomId(url);
}

export function isLoomDomain(url) {
  const s = withScheme(url);
  if (!s) return false;

  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    return /(^|\.)loom\.com$/i.test(host);
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
  if (!/(^|\.)loom\.com$/i.test(host)) return '';

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
  if (!/(^|\.)loom\.com$/i.test(host)) return null;

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
      const videoKey = Object.keys(state).find((k) => k.startsWith('RegularUserVideo:') || k.startsWith('LoomVideo:'));
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
              meta.transcriptText = paragraphs.map((p) => `${formatTime(p.startTime || 0)} ${p.text}`).join('\n');
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
      return data.paragraphs.map((p) => `${formatTime(p.startTime)} ${p.text}`).join('\n');
    }

    // Some Loom exports use {segments:[{start,text}]}.
    if (data && Array.isArray(data.segments)) {
      return data.segments.map((s) => `${formatTime(s.start)} ${s.text}`).join('\n');
    }

    // Some Loom transcript endpoints return {transcript:[{start,end,text}]}.
    if (data && Array.isArray(data.transcript)) {
      return data.transcript.map((t) => `${formatTime(t.start ?? t.startTime)} ${t.text}`).join('\n');
    }

    // As a last resort, accept a flat array of objects.
    if (Array.isArray(data) && data.length && typeof data[0] === 'object') {
      return data.map((t) => `${formatTime(t.start ?? t.startTime)} ${t.text}`).join('\n');
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
