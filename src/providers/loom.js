export function isLoomUrl(url) {
  return /loom\.com\/(share|v|embed)/.test(url);
}

export function extractLoomId(url) {
  const match = url.match(/loom\.com\/(?:share|v|embed)\/([a-zA-Z0-9_\-]+)/);
  return match ? match[1] : null;
}

export function extractLoomMetadataFromHtml(html) {
  let meta = {};

  try {
    // 1. Apollo State (Preferred)
    const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{.*?\});/s);
    if (apolloMatch) {
      const state = JSON.parse(apolloMatch[1]);
      
      // Find the main video object
      const videoKey = Object.keys(state).find(k => k.startsWith('RegularUserVideo:') || k.startsWith('LoomVideo:'));
      if (videoKey && state[videoKey]) {
        const vid = state[videoKey];
        meta.title = vid.name;
        meta.description = vid.description;
        meta.date = vid.createdAt;
        meta.id = vid.id;
        
        // Duration
        if (vid.duration) meta.duration = vid.duration;

        // URL / CDN
        // Keys might have arguments, e.g. nullableRawCdnUrl({"type":"M3U8"})
        const m3u8Key = Object.keys(vid).find(k => k.startsWith('nullableRawCdnUrl'));
        if (m3u8Key && vid[m3u8Key]?.url) {
          meta.mediaUrl = vid[m3u8Key].url;
        }

        // Author
        if (vid.owner && vid.owner.__ref) {
          const owner = state[vid.owner.__ref];
          if (owner) {
            meta.author = [owner.firstName, owner.lastName].filter(Boolean).join(' ');
          }
        }

        // Transcript
        let transcriptRef = null;
        if (vid.transcript && vid.transcript.__ref) {
          transcriptRef = vid.transcript.__ref;
        }
        
        // If not directly linked, try finding *a* transcript, but prioritize linked
        if (!transcriptRef) {
          transcriptRef = Object.keys(state).find(k => k.startsWith('Transcript:'));
        }

        if (transcriptRef && state[transcriptRef]) {
          const tParams = state[transcriptRef].paragraphs;
          if (Array.isArray(tParams)) {
             const paragraphs = tParams.map(ref => {
               if (ref && ref.__ref) return state[ref.__ref];
               return ref;
             }).filter(p => p && p.text);
             
             if (paragraphs.length) {
               meta.transcriptText = paragraphs
                 .map(p => `${formatTime(p.startTime || 0)} ${p.text}`)
                 .join('\n');
             }
          }
        }
      }
    }
  } catch (e) {
    // console.error('Error parsing Loom JS:', e);
  }

  // 2. Fallback to LD+JSON
  if (!meta.title) {
     const ldMatch = html.match(/<script type="application\/ld\+json">\s*(\{.*?\})\s*<\/script>/s);
     if (ldMatch) {
       try {
         const ld = JSON.parse(ldMatch[1]);
         if (ld['@type'] === 'VideoObject') {
           meta.title = ld.name;
           meta.description = ld.description;
           meta.date = ld.uploadDate;
           meta.thumbnailUrl = ld.thumbnailUrl;
           if (ld.author && ld.author.name) meta.author = ld.author.name;
         }
       } catch (e) {}
     }
  }

  return meta;
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
