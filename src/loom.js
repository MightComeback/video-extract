export function isLoomUrl(url) {
  const u = String(url || '').toLowerCase();
  // Loom share URLs: loom.com/share/ID, loom.com/v/ID
  return /loom\.com\/(?:share|v|embed)\/[a-z0-9]+/i.test(u);
}

export function extractLoomId(url) {
  const m = String(url || '').match(/loom\.com\/(?:share|v|embed)\/([a-z0-9]+)/i);
  return m ? m[1] : null;
}

export async function fetchLoomOembed(url, { timeoutMs = 5000 } = {}) {
  const u = String(url || '').trim();
  if (!u) return null;

  try {
    const oembedUrl = `https://www.loom.com/v1/oembed?url=${encodeURIComponent(u)}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    
    const res = await fetch(oembedUrl, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'video-extract/0.1.0' }
    });
    clearTimeout(t);

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchLoomSession(id, { timeoutMs = 5000 } = {}) {
  const i = String(id || '').trim();
  if (!i) return null;

  try {
    const apiUrl = `https://www.loom.com/api/campaigns/sessions/${encodeURIComponent(i)}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'video-extract/0.1.0' }
    });
    clearTimeout(t);

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function extractLoomMetadataFromHtml(html) {
  const s = String(html || '');
  // Extract window.__APOLLO_STATE__
  // Note: we look for the assignment.
  const m = s.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;

  let state;
  try {
    state = JSON.parse(m[1]);
  } catch {
    return null;
  }

  if (!state) return null;

  const result = {
    mediaUrl: null,
    transcriptUrl: null,
    title: null,
    description: null,
    duration: null,
  };

  // Find the RegularUserVideo object
  // Strategy: Look for the first key starting with "RegularUserVideo:"
  const videoKey = Object.keys(state).find(k => k.startsWith('RegularUserVideo:'));
  if (videoKey) {
    const video = state[videoKey];
    if (video) {
      if (video.name) result.title = video.name;
      if (video.description) result.description = video.description;
      if (Number.isFinite(video.duration)) result.duration = video.duration;

      // Extract Media URL (M3U8 preferred)
      // Keys like: nullableRawCdnUrl({"acceptableMimes":["M3U8"],"password":null})
      const m3u8Key = Object.keys(video).find(k => k.startsWith('nullableRawCdnUrl') && k.includes('M3U8'));
      if (m3u8Key && video[m3u8Key] && video[m3u8Key].url) {
        result.mediaUrl = video[m3u8Key].url;
      } else {
        // Fallback: DASH or direct mp4 if implied (Loom usually uses HLS/DASH for playback)
        const dashKey = Object.keys(video).find(k => k.startsWith('nullableRawCdnUrl') && k.includes('DASH'));
        if (dashKey && video[dashKey] && video[dashKey].url) {
          // ffmpeg can handle .mpd
          result.mediaUrl = video[dashKey].url; 
        }
      }
    }
  }

  // Find Transcript
  // Strategy: Look for VideoTranscriptDetails
  const transcriptKey = Object.keys(state).find(k => k.startsWith('VideoTranscriptDetails:'));
  if (transcriptKey) {
    const t = state[transcriptKey];
    if (t) {
      if (t.captions_source_url) {
        result.transcriptUrl = t.captions_source_url;
      } else if (t.source_url) {
        // Fallback to JSON source if VTT missing (caller must handle JSON, or we rely on logic that does)
        // For now, our extractor supports VTT strings and "copy_transcript" JSON. 
        // Loom JSON source_url might need a parser, but let's expose it if it ends in .json
        result.transcriptUrl = t.source_url;
      }
    }
  }

  return result;
}
