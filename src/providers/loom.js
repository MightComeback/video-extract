import { extractJsonBlock, parseSimpleVtt, formatSeconds, extractLdJson } from '../utils.js';

export function isLoomUrl(url) {
  const u = String(url || '').trim();
  // Loom share URLs: loom.com/share/ID, loom.com/v/ID
  // Be stricter to avoid false positives (e.g. google search results)
  return /^(?:https?:\/\/)?(?:www\.)?loom\.com\/(?:share|v|embed)\/[a-z0-9-_]+/i.test(u);
}

export function extractLoomId(url) {
  const m = String(url || '').match(/loom\.com\/(?:share|v|embed)\/([a-z0-9-_]+)/i);
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

export function extractLoomMetadataFromHtml(html, targetId = null) {
  const s = String(html || '');
  
  const result = {
    mediaUrl: null,
    transcriptUrl: null,
    title: null,
    description: null,
    duration: null,
    thumbnailUrl: null,
    date: null,
  };

  let foundData = false;

  // 1. Try Apollo State
  const json = extractJsonBlock(s, /window\.__APOLLO_STATE__\s*=\s*/);
  if (json) {
    let state;
    try { state = JSON.parse(json); } catch {}

    if (state) {
      // Find the video object
      let videoKey = null;
      if (targetId) {
        const candidates = [`RegularUserVideo:${targetId}`, `Video:${targetId}`];
        videoKey = candidates.find(k => state[k]);
      }

      if (!videoKey) {
        videoKey = Object.keys(state).find(k => k.startsWith('RegularUserVideo:'));
      }

      if (videoKey) {
        foundData = true;
        const video = state[videoKey];
        if (video) {
          if (video.name) result.title = video.name;
          if (video.description) result.description = video.description;
          if (Number.isFinite(video.duration)) result.duration = video.duration;
          if (video.posterUrl) result.thumbnailUrl = video.posterUrl;
          else if (video.thumbnailUrl) result.thumbnailUrl = video.thumbnailUrl;
          if (video.createdAt) result.date = video.createdAt;

          const findUrl = (type) => {
            const key = Object.keys(video).find(k => k.startsWith('nullableRawCdnUrl') && k.includes(type));
            return (key && video[key]) ? video[key].url : null;
          };

          result.mediaUrl = findUrl('MP4') || findUrl('M3U8') || findUrl('DASH');

          if (video.owner && video.owner.__ref) {
            const user = state[video.owner.__ref];
            if (user && user.fullName) result.author = user.fullName;
            else if (user && user.firstName && user.lastName) result.author = `${user.firstName} ${user.lastName}`.trim();
          }
        }
      }

      // Find Transcript from Apollo
      const transcriptDetailsKey = Object.keys(state).find(k => k.startsWith('VideoTranscriptDetails:'));
      if (transcriptDetailsKey) {
        const t = state[transcriptDetailsKey];
        if (t) {
          if (t.captions_source_url) result.transcriptUrl = t.captions_source_url;
          else if (t.source_url) result.transcriptUrl = t.source_url;
        }
      }

      let transcriptKey = null;
      if (videoKey && state[videoKey]) {
        const v = state[videoKey];
        for (const k of Object.keys(v)) {
          if (v[k] && v[k].__ref && v[k].__ref.startsWith('Transcript:')) {
            transcriptKey = v[k].__ref;
            break;
          }
        }
      }

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
              let prefix = '';
              if (typeof p.startTime === 'number') {
                prefix = `${formatSeconds(p.startTime)} `;
              }
              parts.push(prefix + p.text.trim());
            }
          }
          if (parts.length > 0) {
            result.transcriptText = parts.join('\n');
          }
        }
      }
    }
  }

  // 2. Try LD+JSON (fallback or augment)
  const ld = extractLdJson(s);
  if (ld && (ld['@type'] === 'VideoObject' || ld['@type'] === 'Video')) {
      foundData = true;
      if (!result.title && ld.name) result.title = ld.name;
      if (!result.description && ld.description) result.description = ld.description;
      if (!result.thumbnailUrl && ld.thumbnailUrl) {
         result.thumbnailUrl = Array.isArray(ld.thumbnailUrl) ? ld.thumbnailUrl[0] : ld.thumbnailUrl;
      }
      if (!result.date && ld.uploadDate) result.date = ld.uploadDate;
      if (!result.author && ld.author) {
         result.author = typeof ld.author === 'string' ? ld.author : (ld.author.name || null);
      }
      // Note: LD+JSON usually doesn't have mediaUrl for Loom, but check if needed.
  }

  return foundData ? result : null;
}

export function parseLoomTranscript(text) {
  if (!text) return '';
  const s = String(text).trim();

  // VTT check
  if (s.startsWith('WEBVTT') || s.includes('-->')) {
    return parseSimpleVtt(s);
  }

  // JSON check
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      const json = JSON.parse(s);
      
      // 1. Simple text field
      if (json.text && typeof json.text === 'string') return json.text;
      
      // 2. Array of segments (e.g. [{text: "Hi"}, {text: "there"}])
      const segments = Array.isArray(json) ? json : (json.paragraphs || json.segments || json.captions || []);
      
      if (Array.isArray(segments) && segments.length > 0) {
         return segments
           .map(p => {
             // Handle { text: "..." } or nested lines
             let text = '';
             if (p.text) text = p.text;
             else if (p.lines && Array.isArray(p.lines)) text = p.lines.map(l => l.text).join(' ');
             
             if (!text) return null;

             // Extract timestamp if available
             const t = p.startTime !== undefined ? p.startTime : (p.start !== undefined ? p.start : null);
             if (typeof t === 'number') {
               return `${formatSeconds(t)} ${text}`;
             }

             return text;
           })
           .filter(Boolean)
           .join('\n');
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  // Fallback: return as-is if it looks like prose? 
  // For now return empty to avoid returning raw JSON or HTML junk.
  return '';
}
