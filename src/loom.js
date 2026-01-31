export function isLoomUrl(url) {
  const u = String(url || '').toLowerCase();
  // Loom share URLs: loom.com/share/ID, loom.com/v/ID
  return /loom\.com\/(?:share|v|embed)\/[a-z0-9]+/i.test(u);
}

export function extractLoomId(url) {
  const m = String(url || '').match(/loom\.com\/(?:share|v|embed)\/([a-z0-9]+)/i);
  return m ? m[1] : null;
}
