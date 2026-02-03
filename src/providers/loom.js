export function isLoomUrl(url) {
  const s = String(url || '').trim();
  if (!s) return false;

  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  let u;
  try {
    u = new URL(withScheme);
  } catch {
    return false;
  }

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  if (host !== 'loom.com') return false;
  return /^(?:\/share\/|\/v\/|\/embed\/)/.test(u.pathname);
}

export function extractLoomId(url) {
  const match = String(url || '').match(/loom\.com\/(?:share|v|embed)\/([a-zA-Z0-9_\-]+)/);
  return match ? match[1] : null;
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
          meta.mediaUrl = vid[chosen].url;
        } else if (vid.nullableRawCdnUrl?.url) {
          meta.mediaUrl = vid.nullableRawCdnUrl.url;
        }

        if (vid.posterUrl && !meta.thumbnailUrl) meta.thumbnailUrl = vid.posterUrl;

        if (vid.owner && vid.owner.__ref) {
          const owner = state[vid.owner.__ref];
          if (owner) {
            meta.author = [owner.firstName, owner.lastName].filter(Boolean).join(' ');
          }
        }

        // Transcript url (VideoTranscriptDetails)
        const vtdKey = Object.keys(state).find((k) => k.startsWith('VideoTranscriptDetails:'));
        if (vtdKey && state[vtdKey]?.source_url) {
          meta.transcriptUrl = state[vtdKey].source_url;
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
  try {
    const data = JSON.parse(text);

    if (data && Array.isArray(data.paragraphs)) {
      return data.paragraphs.map((p) => `${formatTime(p.startTime)} ${p.text}`).join('\n');
    }

    // Some Loom exports use {segments:[{start,text}]}.
    if (data && Array.isArray(data.segments)) {
      return data.segments.map((s) => `${formatTime(s.start)} ${s.text}`).join('\n');
    }
  } catch {
    // ignore
  }
  return String(text || '');
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
