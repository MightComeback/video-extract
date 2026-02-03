export function extractFathomId(url) {
  const s0 = String(url || '').trim();
  if (!s0) return null;

  // Ensure we can parse even if the user omitted scheme.
  // Also accept protocol-relative URLs like "//fathom.video/share/...".
  const withScheme = /^(?:https?:)?\/\//i.test(s0) ? (s0.startsWith('//') ? `https:${s0}` : s0) : `https://${s0}`;

  let u;
  try {
    u = new URL(withScheme);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  if (!/(^|\.)fathom\.video$/i.test(host)) return null;

  const parts = (u.pathname || '/')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const kind = String(parts[0] || '').toLowerCase();
  if (!['share', 'recording'].includes(kind)) return null;

  const id = String(parts[1] || '').trim();
  return /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
}

export function isFathomUrl(url) {
  return !!extractFathomId(url);
}

export function extractFathomTranscriptUrl(html) {
  const h = String(html || '');
  if (!h) return null;

  // JSON blobs in scripts often include: copyTranscriptUrl: "..."
  const m1 = h.match(/(?:["']?copyTranscriptUrl["']?)\s*[:=]\s*"(?<u>https?:\/\/[^"\s]+copy_transcript[^"\s]*)"/i);
  if (m1?.groups?.u) return String(m1.groups.u).replace(/\\u002F/gi, '/').replace(/\\\//g, '/');

  // Direct links
  const m2 = h.match(/href\s*=\s*"(?<u>https?:\/\/[^"\s]+copy_transcript[^"\s]*)"/i);
  if (m2?.groups?.u) return String(m2.groups.u).replace(/\\u002F/gi, '/').replace(/\\\//g, '/');

  return null;
}

// NOTE: full fathom extraction is implemented in src/extractor.js. This provider module
// keeps compatibility exports used by unit tests.
export async function extractFathom(url, page) {
  return { title: '', transcript: '', sourceUrl: url };
}
