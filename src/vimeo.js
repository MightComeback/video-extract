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

export function extractVimeoMetadataFromHtml(html) {
  const s = String(html || '');
  // Look for window.vimeo.clip_page_config = { ... }
  const m = s.match(/window\.vimeo\.clip_page_config\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;

  try {
    const config = JSON.parse(m[1]);
    if (!config || !config.clip) return null;

    const result = {
      title: config.clip.name || null,
      description: null, // Often not in clip object, sometimes in schema
      duration: config.clip.duration?.raw || null,
      author: config.owner?.display_name || null,
      thumbnailUrl: config.clip.poster?.display_src || null,
      mediaUrl: null,
      transcriptUrl: null,
    };

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

    return result;
  } catch {
    return null;
  }
}
