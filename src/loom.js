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

      // Extract Media URL (priority: M3U8 > DASH > MP4)
      const findUrl = (type) => {
        const key = Object.keys(video).find(k => k.startsWith('nullableRawCdnUrl') && k.includes(type));
        return (key && video[key]) ? video[key].url : null;
      };

      result.mediaUrl = findUrl('M3U8') || findUrl('DASH') || findUrl('MP4');

      // Extract Author via normalized reference
      if (video.owner && video.owner.__ref) {
        const user = state[video.owner.__ref];
        if (user && user.fullName) result.author = user.fullName;
        else if (user && user.firstName && user.lastName) result.author = `${user.firstName} ${user.lastName}`.trim();
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

export function extractLoomMetadataFromSession(session) {
  if (!session || typeof session !== 'object') return null;

  const result = {
    title: null,
    description: null,
    duration: null,
    mediaUrl: null,
    transcriptUrl: null, // API usually gives transcripts as objects, not URLs, handled by findTranscriptInObject
  };

  if (session.name) result.title = session.name;
  if (session.description) result.description = session.description;
  if (typeof session.duration === 'number') result.duration = session.duration;

  // Author
  if (session.created_by) {
    const cb = session.created_by;
    if (cb.first_name && cb.last_name) result.author = `${cb.first_name} ${cb.last_name}`.trim();
    else if (cb.name) result.author = cb.name;
  }

  // Media URLs
  // Strategy: check for direct stream fields common in Loom APIs (streams.m3u8, streams.mp4)
  if (session.streams) {
    if (session.streams.m3u8) result.mediaUrl = session.streams.m3u8;
    else if (session.streams.mp4) result.mediaUrl = session.streams.mp4;
  }

  return result;
}
