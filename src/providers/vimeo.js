function withScheme(s) {
  const v = String(s || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

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

  // Match numeric ID anywhere in path segments.
  // Vimeo IDs can be shorter than 6 digits (older content), so be permissive.
  // Keep a small floor to avoid matching incidental numbers in paths.
  // Some Vimeo URLs include multiple numeric segments (e.g. showcases), so prefer the last one.
  const matches = [...u.pathname.matchAll(/\b(\d{3,})\b/g)];
  if (!matches.length) return null;
  return matches[matches.length - 1][1];
}

export function isVimeoUrl(url) {
  return !!extractVimeoId(url);
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
  const en = textTracks.find((t) => String(t.lang || '').toLowerCase().startsWith('en'));
  return en || textTracks[0];
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
  const transcriptUrl = normalizeVimeoAssetUrl(tt?.url) || undefined;

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
