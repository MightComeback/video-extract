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
