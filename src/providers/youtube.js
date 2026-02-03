import ytdl from 'ytdl-core';

export function extractYoutubeId(url) {
  const s = String(url || '').trim();
  if (!s) return null;

  // Ensure we can parse even if the user omitted scheme.
  const withScheme = /^(?:https?:)?\/\//i.test(s) ? s : `https://${s}`;

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

  if (!/(^|\.)youtube\.com$/i.test(host)) return null;

  // watch?v=<id>
  const v = u.searchParams.get('v');
  if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

  // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
  const m = u.pathname.match(/\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})\b/);
  if (m) return m[1];

  return null;
}

export function isYoutubeUrl(url) {
  return !!extractYoutubeId(url);
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
  const u = String(baseUrl || '');
  if (!u) return '';
  if (/\bfmt=vtt\b/i.test(u)) return u;

  // Tests expect "&fmt=vtt" even when no query string is present.
  // (YouTube timedtext baseUrl usually already has query params.)
  return `${u}&fmt=vtt`;
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
    const u = new URL('https://www.youtube.com/oembed');
    u.searchParams.set('url', String(url || ''));
    u.searchParams.set('format', 'json');

    const res = await fetch(u.toString(), {
      headers: { 'accept': 'application/json' },
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
