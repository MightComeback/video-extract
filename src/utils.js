import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

export function extractJsonBlock(html, prefixRegex) {
  const match = html.match(prefixRegex);
  if (!match) return null;
  
  const startIdx = match.index + match[0].length;
  // Look for the first opening brace within reasonable distance
  const snippet = html.slice(startIdx, startIdx + 100);
  const relOpen = snippet.indexOf('{');
  if (relOpen === -1) return null;
  
  const openIdx = startIdx + relOpen;
  
  // Simple stack-based balancer that handles strings
  let depth = 0;
  let inString = false;
  let escaped = false;
  
  for (let i = openIdx; i < html.length; i++) {
    const char = html[i];
    
    if (inString) {
      if (escaped) {
        escaped = false;
      } else {
        if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          // Found matching close brace
          return html.slice(openIdx, i + 1);
        }
      }
    }
  }
  return null;
}

export async function downloadMedia(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unexpected response ${response.statusText}`);
  
  if (response.body) {
      await pipeline(Readable.fromWeb(response.body), createWriteStream(destPath));
  } else {
      throw new Error('No response body');
  }
}

