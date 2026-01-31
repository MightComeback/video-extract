export function isVimeoUrl(url) {
  const u = String(url || '').trim();
  // https://vimeo.com/123456789
  // https://vimeo.com/channels/staffpicks/123456789
  return /^(https?:\/\/)?(www\.)?vimeo\.com\/(\S+\/)?\d+/i.test(u);
}

export function extractVimeoId(url) {
  const u = String(url || '').trim();
  // Simple numeric ID at end
  const m = u.match(/vimeo\.com\/(?:.*\/)?(\d+)/i);
  return m ? m[1] : null;
}

export async function fetchVimeoOembed(url, { timeoutMs = 5000 } = {}) {
  const u = String(url || '').trim();
  if (!u) return null;

  // Vimeo oembed: https://vimeo.com/api/oembed.json?url=...
  try {
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`;
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

function extractMetaContent(html, property) {
  const s = String(html || '');
  // Simple regex for <meta property="..." content="..."> or <meta name="..." content="...">
  // Handles quotes and basic attribute ordering differences
  const re = new RegExp(`<meta\\s+[^>]*?(?:property|name)=["']${property}["'][^>]*?content=["']([^"']+)["']`, 'i');
  const m = s.match(re);
  return m ? m[1] : null;
}

export function extractVimeoMetadataFromHtml(html) {
  const s = String(html || '');
  
  // Try to parse basic metadata regardless of config
  // This allows us to get description even if the main config object is partial
  const metaDescription = 
    extractMetaContent(s, 'og:description') || 
    extractMetaContent(s, 'description') || 
    extractMetaContent(s, 'twitter:description');

  let result = {
    title: null,
    description: metaDescription,
    duration: null,
    author: null,
    thumbnailUrl: null,
    mediaUrl: null,
    transcriptUrl: null,
  };

  // Look for window.vimeo.clip_page_config = { ... }
  const m = s.match(/window\.vimeo\.clip_page_config\s*=\s*(\{[\s\S]*?\});/);
  if (m) {
    try {
      const config = JSON.parse(m[1]);
      if (config && config.clip) {
        result.title = config.clip.name || null;
        result.duration = config.clip.duration?.raw || null;
        result.author = config.owner?.display_name || null;
        result.thumbnailUrl = config.clip.poster?.display_src || null;

        // Media: files.progressive is usually the best for direct MP4
        if (config.request?.files?.progressive?.length) {
          // Sort by width/quality desc
          const sorted = config.request.files.progressive.sort((a, b) => (b.width || 0) - (a.width || 0));
          result.mediaUrl = sorted[0].url;
        } else if (config.request?.files?.hls?.cdns?.fastly_skyfire?.url) {
            result.mediaUrl = config.request.files.hls.cdns.fastly_skyfire.url;
        }

        // Transcript: text_tracks
        if (config.request?.text_tracks?.length) {
          const tracks = config.request.text_tracks;
          // Prefer English
          const en = tracks.find(t => String(t.lang).startsWith('en'));
          result.transcriptUrl = en ? en.url : tracks[0].url;
        }
      }
    } catch {
      // ignore config parse errors, fallback to meta
    }
  }

  // Fallbacks if config didn't provide them
  if (!result.title) {
    result.title = extractMetaContent(s, 'og:title') || extractMetaContent(s, 'twitter:title');
  }
  if (!result.thumbnailUrl) {
    result.thumbnailUrl = extractMetaContent(s, 'og:image') || extractMetaContent(s, 'twitter:image');
  }

  // Return null only if we found NOTHING useful
  const hasAny = result.title || result.description || result.mediaUrl || result.transcriptUrl;
  return hasAny ? result : null;
}
