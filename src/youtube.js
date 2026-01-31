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
