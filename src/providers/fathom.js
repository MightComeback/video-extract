export function isFathomUrl(url) {
  const u = String(url || '').trim();
  if (!u) return false;
  
  // Basic check
  if (u.includes('fathom.video/')) return true;

  try {
    const parsed = new URL(u);
    return parsed.hostname.endsWith('fathom.video') || parsed.hostname === 'fathom.video';
  } catch {
    return false;
  }
}

export function extractFathomTranscriptUrl(html) {
  const s = String(html || '');
  
  // Fathom: copyTranscriptUrl in JSON state
  const m = s.match(/copyTranscriptUrl"\s*:\s*"([^"\s]+\/copy_transcript[^"\s]*)"/i);
  if (m && m[1]) return m[1];

  // Fathom: direct copy_transcript URL match
  const m2 = s.match(/https?:\/\/[^\s"'<>]+\/copy_transcript\b[^\s"'<>]*/i);
  if (m2 && m2[0]) return m2[0];

  return null;
}
