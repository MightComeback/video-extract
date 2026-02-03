import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { normalizeUrlLike } from './brief.js';
import { parseSimpleVtt } from './utils.js';
import { extractFathomTranscriptUrl } from './providers/fathom.js';

function oneLine(s) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function slugify(s) {
  const v = String(s || 'video')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return v || 'video';
}

function isProbablyVideoContentType(ct) {
  const c = String(ct || '').toLowerCase();
  return c.startsWith('video/') || c.includes('application/vnd.apple.mpegurl') || c.includes('application/x-mpegurl');
}

async function probeContentType(url, { headers } = {}) {
  try {
    const res = await fetch(String(url), { method: 'HEAD', headers });
    if (res.ok) return res.headers.get('content-type') || '';
  } catch {
    // Some servers don't support HEAD.
  }

  try {
    const res = await fetch(String(url), { method: 'GET', headers });
    // Drain minimal bytes
    try {
      await res.body?.cancel();
    } catch {
      // ignore
    }
    if (res.ok) return res.headers.get('content-type') || '';
  } catch {
    // ignore
  }

  return '';
}

function collectTextFromHtml(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Replace <br> with newlines for better transcript rendering
  for (const br of [...doc.querySelectorAll('br')]) {
    br.replaceWith(doc.createTextNode('\n'));
  }

  const bodyText = oneLine(doc.body?.textContent || '');
  return bodyText;
}

function extractJsonLd(doc) {
  const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];
  for (const s of scripts) {
    const raw = s.textContent || '';
    if (!raw.trim()) continue;
    try {
      const json = JSON.parse(raw);
      return json;
    } catch {
      // ignore
    }
  }
  return null;
}

export function normalizeFetchedContent(html, sourceUrl) {
  if (!html) return { suggestedTitle: '', description: '', text: '', mediaUrl: '', transcriptUrl: '' };

  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Title
  const suggestedTitle =
    doc.querySelector('meta[property="og:title"]')?.content ||
    doc.querySelector('meta[name="twitter:title"]')?.content ||
    doc.querySelector('title')?.textContent ||
    doc.querySelector('h1')?.textContent ||
    '';

  const description =
    doc.querySelector('meta[property="og:description"]')?.content ||
    doc.querySelector('meta[name="description"]')?.content ||
    doc.querySelector('meta[name="twitter:description"]')?.content ||
    '';

  // Media URL heuristics
  let mediaUrl =
    doc.querySelector('meta[property="og:video"]')?.content ||
    doc.querySelector('meta[property="og:video:url"]')?.content ||
    doc.querySelector('meta[name="twitter:player:stream"]')?.content ||
    '';

  // Transcript from JSON-LD
  const ld = extractJsonLd(doc);
  let transcript = '';
  if (ld && typeof ld === 'object') {
    if (typeof ld.transcript === 'string') transcript = ld.transcript;
    // Some pages embed transcript/captions arrays.
    if (!transcript && Array.isArray(ld.transcript)) transcript = ld.transcript.join('\n');

    if (!mediaUrl) {
      // Some JSON-LD uses contentUrl/embedUrl
      if (typeof ld.contentUrl === 'string') mediaUrl = ld.contentUrl;
      else if (typeof ld.embedUrl === 'string') mediaUrl = ld.embedUrl;
    }
  }

  // Text extraction with <br> handling
  let text = '';
  if (doc.body) {
    const brs = doc.body.querySelectorAll('br');
    brs.forEach((br) => br.replaceWith('\n'));
    text = (doc.body.textContent || '').trim();
  }

  // Prefer transcript over body text if present
  if (transcript) text = transcript;

  return {
    suggestedTitle: (suggestedTitle || '').trim(),
    description: (description || '').trim(),
    text: text || '',
    mediaUrl: mediaUrl || '',
    transcriptUrl: '',
  };
}

function cookieFromFileContent(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';

  // JSON export: [{name,value}, ...]
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) {
        return arr
          .map((c) => {
            const name = c?.name;
            const value = c?.value;
            if (!name) return '';
            return `${name}=${value ?? ''}`;
          })
          .filter(Boolean)
          .join('; ');
      }
    } catch {
      // ignore
    }
  }

  // Look for a Cookie: line in a raw header dump.
  const m = s.match(/^Cookie:\s*(.+)$/im);
  if (m) return m[1].trim();

  // Raw cookie pairs
  return s.replace(/^Cookie:\s*/i, '').trim();
}

function buildHeaders({ cookie, referer, userAgent } = {}) {
  const h = {};
  if (cookie) h.cookie = cookie;
  if (referer) h.referer = referer;
  if (userAgent) h['user-agent'] = userAgent;
  return h;
}

function ffmpegDownload({ url, outPath, cookie, referer, userAgent }) {
  return new Promise((resolve, reject) => {
    const headers = [];
    if (cookie) headers.push(`Cookie: ${cookie}`);
    if (userAgent) headers.push(`User-Agent: ${userAgent}`);
    if (referer) headers.push(`Referer: ${referer}`);

    // ffmpeg expects CRLF between header lines.
    const headerStr = headers.length ? headers.join('\r\n') + '\r\n' : '';

    const args = ['-y', '-loglevel', 'error'];
    if (headerStr) args.push('-headers', headerStr);
    args.push('-i', url, '-c', 'copy', outPath);

    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });

    let err = '';
    child.stderr.on('data', (d) => (err += String(d)));

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(outPath);
      else reject(new Error(`ffmpeg download failed (code ${code}): ${err.trim()}`));
    });
  });
}

function ffmpegSplit({ inPath, outDir, segmentSeconds }) {
  return new Promise((resolve, reject) => {
    ensureDir(outDir);

    const outPattern = path.join(outDir, 'segment_%03d.mp4');

    const args = [
      '-y',
      '-loglevel',
      'error',
      '-i',
      inPath,
      '-c',
      'copy',
      '-map',
      '0',
      '-f',
      'segment',
      '-segment_time',
      String(segmentSeconds),
      '-reset_timestamps',
      '1',
      outPattern,
    ];

    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => (err += String(d)));

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg split failed (code ${code}): ${err.trim()}`));

      const files = fs
        .readdirSync(outDir)
        .filter((f) => /^segment_\d{3}\.mp4$/.test(f))
        .sort()
        .map((f) => path.join(outDir, f));

      resolve(files);
    });
  });
}

function looksLikeUrl(s) {
  try {
    // data: URLs are allowed.
    if (/^data:/i.test(s)) return true;
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

async function fetchText(url, { headers } = {}) {
  const res = await fetch(url, { headers });
  const body = await res.text();
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status} ${res.statusText}`);
    e.status = res.status;
    e.body = body;
    throw e;
  }
  return { res, body };
}

function unescapeJsonSlashes(s) {
  return String(s || '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/');
}

function extractAnyJsonUrls(html, keys = []) {
  const h = String(html || '');
  for (const k of keys) {
    // Allow both JSON-ish: "downloadUrl":"..." and JS-ish: downloadUrl: "..."
    const re = new RegExp(`(?:["']?${k}["']?)\\s*[:=]\\s*\"([^\"\\s]+)\"`, 'i');
    const m = h.match(re);
    if (m) return unescapeJsonSlashes(m[1]);
  }
  return '';
}

async function bestEffortExtract({ url, cookie, referer, userAgent }) {
  const headers = buildHeaders({ cookie, referer, userAgent });

  const { body: html } = await fetchText(url, { headers });
  const normalized = normalizeFetchedContent(html, url);

  let title = normalized.suggestedTitle || '';
  let text = normalized.text || '';
  let mediaUrl = normalized.mediaUrl || '';

  // Prefer Fathom's copy_transcript if present
  const copyTranscriptUrl = extractFathomTranscriptUrl(html);
  if (copyTranscriptUrl) {
    try {
      const { body } = await fetchText(copyTranscriptUrl, { headers });
      const json = JSON.parse(body);
      const transcriptHtml = json?.html || '';
      if (transcriptHtml) {
        text = collectTextFromHtml(transcriptHtml);
      }
    } catch {
      // ignore and fallback to page content
    }
  }

  // If transcript is empty, try to find a VTT url in the page.
  if (!text) {
    const vtt = String(html).match(/https?:\/\/[^"\s']+\.vtt(?:[^"\s']*)?/i)?.[0];
    if (vtt) {
      try {
        const { body } = await fetchText(vtt, { headers });
        text = parseSimpleVtt(body);
      } catch {
        // ignore
      }
    }
  }

  // If still no text, use body text.
  if (!text) text = collectTextFromHtml(html);

  // Media URL can be in common JSON blobs.
  if (!mediaUrl) {
    mediaUrl =
      extractAnyJsonUrls(html, ['downloadUrl', 'mediaUrl', 'videoUrl']) ||
      '';
  }

  // If mediaUrl has no extension, probe content-type and accept if video.
  if (mediaUrl && !/\.[a-z0-9]{2,5}(?:\?|#|$)/i.test(mediaUrl)) {
    const ct = await probeContentType(mediaUrl, { headers });
    if (!isProbablyVideoContentType(ct)) {
      // Reject non-video URLs.
      mediaUrl = '';
    }
  }

  return {
    title,
    text,
    mediaUrl,
    html,
  };
}

export async function extractFromUrl(rawUrl, options = {}) {
  const url = normalizeUrlLike(rawUrl);
  if (!looksLikeUrl(url)) throw new Error('Invalid URL');

  const cookie = options.cookie || '';
  const referer = options.referer || '';
  const userAgent = options.userAgent || `fathom-extract/${options.version || '0.0.0'}`;

  const outDir = options.outDir || '';
  const noDownload = !!options.noDownload;
  const noSplit = !!options.noSplit;
  const splitSeconds = Number.isFinite(Number(options.splitSeconds)) ? Number(options.splitSeconds) : Number(process.env.FATHOM_SPLIT_SECONDS || 300);

  const result = {
    ok: false,
    sourceUrl: url,
    title: '',
    text: '',
    mediaUrl: '',
    fetchError: '',
    artifactsDir: outDir || '',
    transcriptPath: '',
    mediaPath: '',
    mediaSegmentsDir: '',
    mediaSegments: [],
    mediaSegmentsListPath: '',
    segmentSeconds: splitSeconds,
    mediaDownloadError: '',
  };

  // Ensure output dir exists early (so we can write stub artifacts even on fetch failures)
  if (outDir) ensureDir(outDir);

  try {
    const ex = await bestEffortExtract({ url, cookie, referer, userAgent });
    result.ok = true;
    result.title = ex.title || '';
    result.text = ex.text || '';
    result.mediaUrl = ex.mediaUrl || '';
  } catch (e) {
    result.ok = false;
    result.fetchError = e?.message || String(e);
    result.title = '';
    result.text = [
      'Unable to fetch this link.',
      `Source: ${url}`,
      `Fetch error: ${result.fetchError}`,
      '',
      'If this link is auth-gated, pass cookies:',
      '- FATHOM_COOKIE=... (or --cookie)',
      '- FATHOM_COOKIE_FILE=... (or --cookie-file)',
    ].join('\n');
  }

  // Write transcript.txt and extracted.json if outDir requested.
  if (outDir) {
    result.transcriptPath = path.join(outDir, 'transcript.txt');
    fs.writeFileSync(result.transcriptPath, String(result.text || ''), 'utf8');
  }

  // Download media (default ON)
  if (!noDownload) {
    if (!result.mediaUrl) {
      result.mediaDownloadError = 'mediaUrl not found';
    } else if (outDir) {
      try {
        const mediaPath = options.mediaOutPath || path.join(outDir, `${slugify(result.title)}.mp4`);
        await ffmpegDownload({
          url: result.mediaUrl,
          outPath: mediaPath,
          cookie,
          referer: referer || url,
          userAgent,
        });
        result.mediaPath = mediaPath;

        if (!noSplit) {
          result.mediaSegmentsDir = path.join(outDir, 'segments');
          const segments = await ffmpegSplit({ inPath: mediaPath, outDir: result.mediaSegmentsDir, segmentSeconds: splitSeconds });
          result.mediaSegments = segments;
          result.mediaSegmentsListPath = path.join(outDir, 'segments.txt');
          fs.writeFileSync(result.mediaSegmentsListPath, segments.join('\n') + (segments.length ? '\n' : ''), 'utf8');
        }
      } catch (e) {
        result.mediaDownloadError = e?.message || String(e);
      }
    }
  }

  if (outDir) {
    const extractedPath = path.join(outDir, 'extracted.json');
    fs.writeFileSync(extractedPath, JSON.stringify(result, null, 2), 'utf8');
  }

  return result;
}

// Backwards compat name used by older tests
export const extractFathomData = extractFromUrl;

export function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
}

export function findTranscriptInObject(obj) {
  if (!obj) return '';
  let items = [];
  if (Array.isArray(obj)) items = obj;
  else if (obj.transcript && Array.isArray(obj.transcript)) items = obj.transcript;
  else if (obj.captions && Array.isArray(obj.captions)) items = obj.captions;

  if (!items.length) return '';

  const fmt = (time) => {
    const s = Math.floor(Number(time) || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
    return `${m}:${String(sc).padStart(2, '0')}`;
  };

  return items
    .map((item) => {
      const time = item.startTime !== undefined ? item.startTime : item.start !== undefined ? item.start : 0;
      const text = item.text || '';
      return `${fmt(time)}: ${text}`;
    })
    .join('\n');
}

export function extractTranscriptUrlFromHtml(html) {
  const h = String(html || '');
  if (!h) return '';
  const regex = /https?:\/\/[^"\s']+\.vtt(?:[^"\s']*)?/gi;
  const matches = h.match(regex);
  if (!matches || matches.length === 0) return '';
  const unique = [...new Set(matches)];
  const en = unique.find((u) => /_en\.vtt|\ben\.vtt/i.test(u));
  return en || unique[0];
}

export function resolveAuthor(html) {
  const h = String(html || '');
  if (!h) return null;

  // Match a meta tag that contains name="author" (attribute order can vary).
  const tag = h.match(/<meta\b[^>]*\bname\s*=\s*(?:"author"|'author')[^>]*>/i);
  const t = tag ? tag[0] : '';
  if (!t) return null;

  const m = t.match(/\bcontent\s*=\s*(?<q>["'])(?<v>[\s\S]*?)\k<q>/i);
  return String(m?.groups?.v || '').trim() || null;
}

export function extractFromStdin({ content, source } = {}) {
  const raw = String(content || '').trim();
  if (!raw) throw Object.assign(new Error('stdin is empty'), { message: 'stdin is empty' });

  const lines = raw.replace(/\r/g, '').split('\n');

  let src = '';
  let title = '';
  let description = '';
  let author = '';
  let date = '';
  const body = [];

  const take = (v) => String(v || '').trim();

  for (const l0 of lines) {
    const l = String(l0 || '').replace(/^>+\s*/g, '').trim();
    if (!l) continue;

    // Markdown heading title
    if (!title) {
      const mh = l.match(/^#{1,6}\s+(.*)$/);
      if (mh) {
        title = take(mh[1]);
        continue;
      }
    }

    const kv = l.match(/^(?<k>[a-zA-Z][a-zA-Z ]{1,30})\s*[:=\-–—]\s*(?<v>.+)$/);
    if (kv) {
      const k = kv.groups.k.trim().toLowerCase();
      const v = take(kv.groups.v);

      if (!src && /^(source|link|url|recording|video link|loom link|fathom link|share link|meeting|call)$/.test(k)) {
        src = normalizeUrlLike(v);
        continue;
      }

      if (!title && /^(title|subject|topic)$/.test(k)) {
        title = v;
        continue;
      }

      if (!description && /^(description|summary)$/.test(k)) {
        description = v;
        continue;
      }

      if (!author && /^(author|who|by)$/.test(k)) {
        author = v;
        continue;
      }

      if (!date && /^date$/.test(k)) {
        date = v;
        continue;
      }
    }

    // Bare URL on its own line (common copy/paste)
    if (!src && (/^https?:\/\//i.test(l) || /\bfathom\.video\//i.test(l) || /\bloom\.com\//i.test(l))) {
      const n = normalizeUrlLike(l);
      if (n && (/^https?:\/\//i.test(n) || /^data:/i.test(n))) {
        src = n;
        continue;
      }
    }

    // Otherwise it's transcript/body text
    body.push(l.replace(/^>+\s*/g, ''));
  }

  return {
    ok: true,
    source: src || (source ? normalizeUrlLike(source) : undefined),
    title: title || '',
    description: description || undefined,
    author: author || undefined,
    date: date || undefined,
    text: body.join('\n').trim(),
  };
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  if (!s) return '';
  if (/[\n",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function formatCsv(data = {}) {
  // date, title, source, mediaUrl, description, screenshot, text
  return [
    csvCell(data.date),
    csvCell(data.title),
    csvCell(data.source || data.sourceUrl),
    csvCell(data.mediaUrl),
    csvCell(data.description),
    csvCell(data.screenshot),
    csvCell(data.text),
  ].join(',');
}

export function cookieFromFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return cookieFromFileContent(raw);
}
