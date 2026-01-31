export function isYoutubeUrl(url) {
  const u = String(url || '').trim();
  // Handles:
  // youtube.com/watch?v=ID
  // youtube.com/embed/ID
  // youtube.com/v/ID
  // youtube.com/shorts/ID
  // youtu.be/ID
  return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/i.test(u);
}

export function extractYoutubeId(url) {
  const u = String(url || '').trim();
  const m = u.match(/(?:v=|embed\/|v\/|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return m ? m[1] : null;
}

export async function fetchYoutubeOembed(url, { timeoutMs = 5000 } = {}) {
  const u = String(url || '').trim();
  if (!u) return null;

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json`;
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

export function extractYoutubeMetadataFromHtml(html) {
  const s = String(html || '');
  // Look for ytInitialPlayerResponse (variable assignment)
  const m = s.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;

  try {
    const data = JSON.parse(m[1]);
    if (!data || !data.videoDetails) return null;

    const d = data.videoDetails;
    const result = {
      title: d.title || null,
      description: d.shortDescription || null,
      duration: d.lengthSeconds ? Number(d.lengthSeconds) : null,
      author: d.author || null,
      channelId: d.channelId || null,
      viewCount: d.viewCount ? Number(d.viewCount) : null,
      isLive: d.isLiveContent || false,
      mediaUrl: null,
      transcriptUrl: null,
      thumbnailUrl: d.thumbnail?.thumbnails?.length 
        ? d.thumbnail.thumbnails[d.thumbnail.thumbnails.length - 1].url 
        : null
    };

    // Extract caption tracks
    // Typical path: captions.playerCaptionsTracklistRenderer.captionTracks[]
    if (data.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) {
      const tracks = data.captions.playerCaptionsTracklistRenderer.captionTracks;
      
      // Sort: Priority to English ('en'), then non-ASR (manual) over ASR (auto-generated)
      const sorted = tracks.sort((a, b) => {
        const aLang = String(a.languageCode || '').toLowerCase();
        const bLang = String(b.languageCode || '').toLowerCase();
        const aEn = aLang.startsWith('en');
        const bEn = bLang.startsWith('en');
        
        if (aEn && !bEn) return -1;
        if (!aEn && bEn) return 1;
        
        const aAsr = (a.kind === 'asr');
        const bAsr = (b.kind === 'asr');
        
        if (!aAsr && bAsr) return -1;
        if (aAsr && !bAsr) return 1;
        
        return 0;
      });

      if (sorted[0]?.baseUrl) {
        // Force VTT format if not already specified.
        // YouTube API usually respects &fmt=vtt for caption tracks.
        let url = sorted[0].baseUrl;
        if (!url.includes('fmt=')) {
          url += '&fmt=vtt';
        }
        result.transcriptUrl = url;
      }
    }

    return result;
  } catch {
    return null;
  }
}
