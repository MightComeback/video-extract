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
