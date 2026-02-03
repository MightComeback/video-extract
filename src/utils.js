import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';

export function parseSimpleVtt(text) {
  const s = String(text || '');
  if (!s.trim()) return '';

  // Extremely simple VTT -> plain text extractor.
  // Keep it deterministic for tests.
  const lines = s
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trimEnd());

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (i === 0 && /^WEBVTT\b/i.test(line)) continue;

    // Skip cue identifiers (a line of digits) if it's followed by a timing line.
    if (/^\d+$/.test(line) && i + 1 < lines.length && /-->/.test(lines[i + 1])) {
      continue;
    }

    // Skip timing lines.
    if (/-->/.test(line)) continue;

    out.push(line);
  }

  // Merge with spaces; this matches the unit test expectations.
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

export async function downloadMedia(url, destPath) {
  const res = await fetch(String(url || ''));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  await fs.promises.mkdir(new URL('.', `file://${destPath}`).pathname, { recursive: true }).catch(() => {});

  const file = fs.createWriteStream(destPath);
  await pipeline(res.body, file);
  return destPath;
}
