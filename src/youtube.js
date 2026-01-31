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
