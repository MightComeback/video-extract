export function isLoomUrl(url) {
  return /loom\.com\/(share|v|embed)/.test(url);
}

export function extractLoomId(url) {
  const match = url.match(/loom\.com\/(?:share|v|embed)\/([a-zA-Z0-9_\-]+)/);
  return match ? match[1] : null;
}

export function extractLoomMetadataFromHtml(html) {
  return {}; // detailed implementation later
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function parseLoomTranscript(text) {
  try {
    const data = JSON.parse(text);
    if (data && Array.isArray(data.paragraphs)) {
      return data.paragraphs
        .map(p => `${formatTime(p.startTime)} ${p.text}`)
        .join('\n');
    }
  } catch (e) {
    // ignore
  }
  return text; 
}

export async function fetchLoomOembed(url) {
  return null;
}
