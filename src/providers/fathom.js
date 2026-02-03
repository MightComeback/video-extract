export function isFathomUrl(url) {
  const s = String(url || '').trim();
  if (!s) return false;
  return /fathom\.video/i.test(s);
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
