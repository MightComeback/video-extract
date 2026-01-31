export function isLoomUrl(url) {
  const u = String(url || '').trim();
  // Loom share URLs: loom.com/share/ID, loom.com/v/ID
  // Be stricter to avoid false positives (e.g. google search results)
  return /^(?:https?:\/\/)?(?:www\.)?loom\.com\/(?:share|v|embed)\/[a-z0-9-]+/i.test(u);
}

export function extractLoomId(url) {
  const m = String(url || '').match(/loom\.com\/(?:share|v|embed)\/([a-z0-9-]+)/i);
  return m ? m[1] : null;
}

export async function fetchLoomOembed(url, { timeoutMs = 5000, userAgent = null } = {}) {
  const u = String(url || '').trim();
  if (!u) return null;

  try {
    const oembedUrl = `https://www.loom.com/v1/oembed?url=${encodeURIComponent(u)}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    
    // Note: OEmbed seems to accept generic UAs fine (unlike share pages).
    const res = await fetch(oembedUrl, { 
      signal: controller.signal,
      headers: { 'User-Agent': userAgent || 'video-extract/0.1.0' }
    });
    clearTimeout(t);

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function extractJsonBlock(html, prefixRegex) {
  const match = html.match(prefixRegex);
  if (!match) return null;
  
  const startIdx = match.index + match[0].length;
  // Look for the first opening brace within reasonable distance
  const snippet = html.slice(startIdx, startIdx + 100);
  const relOpen = snippet.indexOf('{');
  if (relOpen === -1) return null;
  
  const openIdx = startIdx + relOpen;
  
  // Simple stack-based balancer that handles strings
  let depth = 0;
  let inString = false;
  let escaped = false;
  
  for (let i = openIdx; i < html.length; i++) {
    const char = html[i];
    
    if (inString) {
      if (escaped) {
        escaped = false;
      } else {
        if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          // Found matching close brace
          return html.slice(openIdx, i + 1);
        }
      }
    }
  }
  return null;
}

export function extractLoomMetadataFromHtml(html, targetId = null) {
  const s = String(html || '');
  // Extract window.__APOLLO_STATE__
  // Note: we look for the assignment.
  const json = extractJsonBlock(s, /window\.__APOLLO_STATE__\s*=\s*/);
  if (!json) return null;

  let state;
  try {
    state = JSON.parse(json);
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
    thumbnailUrl: null,
    date: null,
  };

  // Find the video object
  let videoKey = null;
  if (targetId) {
    // Try precise lookup if we know the ID
    const candidates = [`RegularUserVideo:${targetId}`, `Video:${targetId}`];
    videoKey = candidates.find(k => state[k]);
  }

  if (!videoKey) {
    // Fallback: Use the first RegularUserVideo or any object that looks like the main video
    videoKey = Object.keys(state).find(k => k.startsWith('RegularUserVideo:'));
  }

  if (videoKey) {
    const video = state[videoKey];
    if (video) {
      if (video.name) result.title = video.name;
      if (video.description) result.description = video.description;
      if (Number.isFinite(video.duration)) result.duration = video.duration;
      if (video.posterUrl) result.thumbnailUrl = video.posterUrl;
      else if (video.thumbnailUrl) result.thumbnailUrl = video.thumbnailUrl;
      if (video.createdAt) result.date = video.createdAt;

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
  const transcriptDetailsKey = Object.keys(state).find(k => k.startsWith('VideoTranscriptDetails:'));
  if (transcriptDetailsKey) {
    const t = state[transcriptDetailsKey];
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

  // Strategy: Look for in-memory Transcript object (avoid fetching if possible)
  // Usually has structure: Transcript:XYZ -> paragraphs -> [ {__ref: 'TranscriptParagraph:ABC'}, ... ]
  let transcriptKey = null;

  // 1. Try to find explicit link from video object (most robust)
  // The field name varies (transcript, videoTranscript, etc), but if we see a ref to "Transcript:...", use it.
  if (videoKey && state[videoKey]) {
    const v = state[videoKey];
    for (const k of Object.keys(v)) {
      if (v[k] && v[k].__ref && v[k].__ref.startsWith('Transcript:')) {
        transcriptKey = v[k].__ref;
        break;
      }
    }
  }

  // 2. Fallback: scan all keys for any Transcript object
  if (!transcriptKey) {
    transcriptKey = Object.keys(state).find(k => k.startsWith('Transcript:') && state[k].paragraphs);
  }

  if (transcriptKey) {
    const tObj = state[transcriptKey];
    if (Array.isArray(tObj.paragraphs)) {
      const parts = [];
      for (const ref of tObj.paragraphs) {
        const p = ref && ref.__ref ? state[ref.__ref] : null;
        if (p && p.text) {
          // Attempt to format timestamp if available (seconds)
          let prefix = '';
          if (typeof p.startTime === 'number') {
            const s = Math.floor(p.startTime);
            const mm = Math.floor(s / 60);
            const ss = s % 60;
            prefix = `${mm}:${String(ss).padStart(2, '0')} `;
          }
          parts.push(prefix + p.text.trim());
        }
      }
      if (parts.length > 0) {
        result.transcriptText = parts.join('\n');
      }
    }
  }

  return result;
}
