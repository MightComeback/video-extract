import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

import { normalizeUrlLike } from './brief.js';
import { isLoomUrl, fetchLoomOembed, extractLoomId, extractLoomMetadataFromHtml, fetchLoomSession } from './loom.js';
import { isYoutubeUrl, fetchYoutubeOembed } from './youtube.js';

export function readStdin() {
  // If the user runs `fathom2action --stdin` interactively without piping input,
  // stdin is a TTY and the process would otherwise hang waiting for EOF.
  if (process.stdin.isTTY) {
    console.error('Warning: --stdin flag used but no input piped (stdin is a TTY).');
    return Promise.resolve('');
  }

  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
}

export function getVersion() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const pkgPath = path.resolve(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function resolveUserAgent(override = null) {
  const o = String(override || '').trim();
  if (o) return o;

  const env = String(process.env.VIDEO_EXTRACT_USER_AGENT || process.env.FATHOM_USER_AGENT || '').trim();
  if (env) return env;

  const platform = process.platform || 'unknown';
  const arch = process.arch || 'unknown';
  return `fathom-extract/${getVersion()} (${platform}; ${arch}) (+https://github.com/MightComeback/fathom-extract)`;
}

function decodeHtmlEntities(s) {
  let out = String(s)
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&copy;', '©')
    .replaceAll('&reg;', '®')
    .replaceAll('&trade;', '™')
    // Common named punctuation entities (frequently show up in titles/notes)
    .replaceAll('&hellip;', '…')
    .replaceAll('&ndash;', '–')
    .replaceAll('&mdash;', '—')
    .replaceAll('&rsquo;', '’')
    .replaceAll('&lsquo;', '‘')
    .replaceAll('&rdquo;', '”')
    .replaceAll('&ldquo;', '“');

  // Best-effort numeric entities.
  // Examples: &#8217; (’) and &#x2019; (’)
  out = out.replaceAll(/&#(\d+);/g, (_, n) => {
    const cp = Number(n);
    if (!Number.isFinite(cp)) return _;
    // Guard against invalid ranges that would throw in fromCodePoint.
    if (cp < 0 || cp > 0x10ffff) return _;
    try {
      return String.fromCodePoint(cp);
    } catch {
      return _;
    }
  });
  out = out.replaceAll(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const cp = parseInt(hex, 16);
    if (!Number.isFinite(cp)) return _;
    if (cp < 0 || cp > 0x10ffff) return _;
    try {
      return String.fromCodePoint(cp);
    } catch {
      return _;
    }
  });

  return out;
}

function extractMetaContent(html, { name, property }) {
  const s = String(html);
  const metas = s.match(/<meta\s+[^>]*>/gi) || [];

  for (const tag of metas) {
    const attrs = {};

    // Best-effort attribute parse: key="value", key='value', and key=value
    for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([\s\S]*?)"|'([\s\S]*?)'|([^"'\s>]+))/g)) {
      const key = (m[1] || '').toLowerCase();
      const val = m[2] ?? m[3] ?? m[4] ?? '';
      attrs[key] = val;
    }

    const hasName = name && String(attrs.name || '').toLowerCase() === String(name).toLowerCase();
    const hasProp = property && String(attrs.property || '').toLowerCase() === String(property).toLowerCase();
    if (!hasName && !hasProp) continue;

    const content = attrs.content;
    if (!content) continue;

    return decodeHtmlEntities(content).trim().replace(/\s+/g, ' ').trim();
  }

  return '';
}

function extractLdJson(html) {
  const s = String(html);
  const matches = s.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const out = [];
  for (const m of matches) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      // ignore
    }
  }
  return out;
}

function extractVideoUrlFromHtml(html) {
  const s = String(html);

  // 1. Precise: Schema.org VideoObject (common on Loom, YouTube, Vimeo)
  const ld = extractLdJson(s);
  const flat = ld.flatMap(o => o['@graph'] || o);
  const videoObj = flat.find(o => String(o['@type']).toLowerCase() === 'videoobject');
  
  if (videoObj) {
    // Prefer contentUrl (actual file) over embedUrl (player).
    if (videoObj.contentUrl) return decodeHtmlEntities(videoObj.contentUrl).trim();
    if (videoObj.embedUrl) return decodeHtmlEntities(videoObj.embedUrl).trim();
  }

  // Common OpenGraph video fields.
  const ogVideo =
    extractMetaContent(s, { property: 'og:video' }) ||
    extractMetaContent(s, { property: 'og:video:url' }) ||
    extractMetaContent(s, { property: 'og:video:secure_url' }) ||
    '';
  if (ogVideo) return ogVideo;

  // Sometimes a share page points to an embeddable player.
  const twitterPlayer = extractMetaContent(s, { name: 'twitter:player' }) || '';
  if (twitterPlayer) return twitterPlayer;

  // Best-effort: <video src="..."> or <source src="...">
  const m1 = s.match(/<video[^>]*\s+src=("([^"]+)"|'([^']+)')[^>]*>/i);
  if (m1) return decodeHtmlEntities(m1[2] || m1[3] || '').trim();

  const m2 = s.match(/<source[^>]*\s+src=("([^"]+)"|'([^']+)')[^>]*>/i);
  if (m2) return decodeHtmlEntities(m2[2] || m2[3] || '').trim();

  // Some share pages stash the actual media URL in JSON-LD (contentUrl) or similar JSON blobs.
  // Keep this conservative: only absolute URLs with a media-ish extension.
  const jsonKeyMatch = s.match(/"(?:contentUrl|embedUrl|url)"\s*:\s*"(https?:\\\/\\\/[^\"<>]+\.(?:m3u8|mp4|mov|m4v|webm)(?:\?[^\"<>]*)?)"/i);
  if (jsonKeyMatch) return decodeHtmlEntities(jsonKeyMatch[1]).trim().replaceAll('\\/', '/');

  // Some providers expose a direct playback/download URL without an extension.
  // We'll return it here and let resolveMediaUrl() probe content-type to confirm it's video.
  const scanJson = s.replaceAll('\\/', '/');
  const jsonNoExtMatch = scanJson.match(
    /"(?:downloadUrl|videoUrl|mediaUrl|playbackUrl|streamUrl)"\s*:\s*"(https?:\/\/[^\"<>]+)"/i
  );
  if (jsonNoExtMatch) return decodeHtmlEntities(jsonNoExtMatch[1]).trim();

  // Last-resort: scan for direct media URLs embedded in scripts (common on share/call pages).
  // Use a URL-ish matcher that *excludes backslashes* so we don't accidentally slurp JSON-escaped blobs.
  // Also handle:
  // - HTML entities (e.g. &quot;) that can otherwise be glued onto URLs inside attributes
  // - JSON-escaped slashes like https:\/\/...
  const scan = decodeHtmlEntities(s).replaceAll('\\/', '/');

  const urlish = Array.from(
    scan.matchAll(/https?:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/gi)
  ).map((m) => m[0]);

  const mediaCandidates = urlish
    .map((u) => decodeHtmlEntities(u).trim())
    .map((u) => u.replace(/[)\]>'\"]+$/g, ''))
    .filter((u) => /\.(?:m3u8|mp4|mov|m4v|webm)(?:\?|$)/i.test(u));

  if (mediaCandidates.length) return mediaCandidates[mediaCandidates.length - 1];

  return '';
}

function resolveMaybeRelativeUrl(url, baseUrl) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (!baseUrl) return u;

  // Only attempt to resolve clearly relative URLs.
  if (/^https?:\/\//i.test(u) || /^data:/i.test(u)) return u;

  try {
    return new URL(u, String(baseUrl)).toString();
  } catch {
    return u;
  }
}

function extractTitleFromHtml(html) {
  const s = String(html);
  const t = s.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) {
    const raw = decodeHtmlEntities(t[1] || '').trim();
    return raw.replace(/\s+/g, ' ').trim();
  }

  // Fallbacks commonly present on share pages.
  const metaTitle =
    extractMetaContent(s, { property: 'og:title' }) ||
    extractMetaContent(s, { name: 'twitter:title' }) ||
    '';
  if (metaTitle) return metaTitle;

  // Last-resort fallback: first H1.
  const h1 = s.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const raw = decodeHtmlEntities(h1[1] || '').trim();
    const text = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text) return text;
  }

  return '';
}

function extractDescriptionFromHtml(html) {
  const s = String(html);
  return (
    extractMetaContent(s, { property: 'og:description' }) ||
    extractMetaContent(s, { name: 'twitter:description' }) ||
    extractMetaContent(s, { name: 'description' }) ||
    ''
  );
}

function extractScreenshotFromHtml(html) {
  const s = String(html);
  return (
    extractMetaContent(s, { property: 'og:image' }) ||
    extractMetaContent(s, { name: 'twitter:image' }) ||
    extractMetaContent(s, { itemprop: 'image' }) ||
    ''
  );
}

function stripHtmlToText(html) {
  let s = String(html);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  // Preserve some structure as newlines before stripping tags.
  // Support <br>, <br/>, and <br />.
  s = s.replace(/<br\s*\/?\s*>/gi, '\n');
  // Common block-ish closing tags.
  s = s.replace(/<\s*\/(p|div|li|h\d|tr)\s*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeHtmlEntities(s);
  s = s.replace(/\r/g, '');
  s = s.replace(/\n\s*\n\s*\n+/g, '\n\n');
  s = s.replace(/[\t\f\v ]+/g, ' ');
  return s.trim();
}

function sliceLikelyTranscript(text) {
  const s = String(text || '').replace(/\r/g, '');
  if (!s) return '';

  // Heuristic for common share pages that include a bunch of sections.
  // We try to isolate the “Transcript” section if present.
  const lower = s.toLowerCase();
  const startKeywords = ['\ntranscript\n', '\ntranscript:', '\ntranscript \n', ' transcript\n'];
  let start = -1;
  for (const k of startKeywords) {
    const i = lower.indexOf(k);
    if (i !== -1) {
      start = i;
      break;
    }
  }
  if (start === -1) return '';

  // Skip the keyword line itself.
  const after = s.slice(start).split('\n');
  while (after.length && after[0].trim().toLowerCase().startsWith('transcript')) after.shift();

  const lines = after.join('\n').split('\n');

  const stopLine = (line) => {
    const t = String(line || '').trim().toLowerCase();
    if (!t) return false;
    return (
      t === 'notes' ||
      t.startsWith('notes:') ||
      t === 'chapters' ||
      t.startsWith('chapters:') ||
      t === 'summary' ||
      t.startsWith('summary:') ||
      t === 'actions' ||
      t.startsWith('actions:')
    );
  };

  const kept = [];
  for (const line of lines) {
    if (stopLine(line)) break;
    kept.push(line);
  }

  const candidate = kept.join('\n').trim();
  if (!candidate) return '';

  // Only accept if it looks transcript-y (timestamps or lots of sentences).
  const hasTimestamps = /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(candidate);
  const lineCount = candidate.split('\n').filter((l) => l.trim()).length;
  if (hasTimestamps || lineCount >= 3) return candidate;

  return '';
}

// Superseded by extractTranscriptUrlFromHtml

function formatTimestamp(secondsLike) {
  const n = Number(secondsLike);
  if (!Number.isFinite(n) || n < 0) return '';

  // Heuristic: treat very large values as milliseconds.
  const sec = n > 1e6 ? n / 1000 : n;

  const total = Math.floor(sec);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;

  const two = (x) => String(x).padStart(2, '0');
  return hh > 0 ? `${hh}:${two(mm)}:${two(ss)}` : `${mm}:${two(ss)}`;
}

export function findTranscriptInObject(parsed) {
  if (!parsed) return '';

  // Prefer structured transcript arrays when present (keeps ordering + speaker/timestamps).
  function tryStructuredTranscript(x) {
    const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

    function findTranscriptArrays(node) {
      const out = [];
      const seen = new Set();
      const visited = new Set();

      function walk(n) {
        if (n == null) return;
        if (typeof n !== 'object') return;
        if (visited.has(n)) return;
        visited.add(n);

        if (Array.isArray(n)) {
          for (const v of n) walk(v);
          return;
        }

        for (const [k, v] of Object.entries(n)) {
          const lk = String(k).toLowerCase();
          if (
            lk.includes('transcript') ||
            lk === 'utterances' ||
            lk === 'sentences' ||
            lk === 'segments' ||
            lk === 'captions'
          ) {
            if (Array.isArray(v) && !seen.has(v)) {
              seen.add(v);
              out.push(v);
            }
          }
          walk(v);
        }
      }

      walk(x);
      return out;
    }

    const candidates = findTranscriptArrays(x);
    for (const arr of candidates) {
      if (!arr.length) continue;
      // Require at least a couple objects with text-ish content.
      const objs = arr.filter(isObj);
      if (objs.length < 2) continue;

      const lines = [];
      for (const o of objs) {
        const text = decodeHtmlEntities(o.text ?? o.content ?? o.caption ?? '').trim();
        if (!text) continue;

        const who = decodeHtmlEntities(o.speaker ?? o.speakerName ?? o.speaker_name ?? o.name ?? '').trim();
        const t =
          o.startTime ??
          o.start_time ??
          o.start ??
          o.time ??
          o.timestamp ??
          (o.startMs != null ? Number(o.startMs) / 1000 : null) ??
          null;
        const ts = t != null ? formatTimestamp(t) : '';

        const prefix = [ts, who].filter(Boolean).join(' ');
        lines.push(prefix ? `${prefix}: ${text}` : text);
      }

      const joined = lines.join('\n').trim();
      if (joined.length >= 20) return joined;
    }

    return '';
  }

  const structured = tryStructuredTranscript(parsed);
  if (structured) return structured;

  const parts = [];
  const seen = new Set();
  const visited = new Set();

  function walk(x) {
    if (x == null) return;
    if (typeof x === 'string') {
      // Keep only likely transcript-y strings (avoid huge minified blobs).
      const t = decodeHtmlEntities(x).trim();
      if (t.length >= 3 && t.length <= 5000 && /\s/.test(t)) {
        if (!seen.has(t)) {
          seen.add(t);
          parts.push(t);
        }
      }
      return;
    }
    if (typeof x !== 'object') return;
    if (visited.has(x)) return;
    visited.add(x);

    if (Array.isArray(x)) {
      for (const v of x) walk(v);
      return;
    }

    const keys = Object.keys(x);

    // Prefer explicit transcript fields if present.
    for (const k of keys) {
      const lk = k.toLowerCase();
      const v = x[k];
      if (lk.includes('transcript') || lk === 'utterances' || lk === 'sentences' || lk === 'segments') {
        walk(v);
      }
    }

    // Scan a few common text keys.
    for (const k of keys) {
      const lk = k.toLowerCase();
      if (lk === 'text' || lk === 'content' || lk === 'caption') {
        walk(x[k]);
      }
    }

    // Finally, recurse through the rest (best-effort), so nested transcript fields are reachable.
    for (const k of keys) {
      walk(x[k]);
    }
  }

  walk(parsed);

  const joined = parts.join('\n').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  if (joined.length >= 20) return joined;
  
  return '';
}

function tryExtractTranscriptFromEmbeddedJson(html) {
  const s = String(html);

  // Common patterns on modern share pages / app shells.
  const scriptJson = [];

  // Inertia-style app shells: <div id="app" data-page="{...}">
  for (const m of s.matchAll(/data-page\s*=\s*"([^"]+)"/gi)) {
    scriptJson.push(decodeHtmlEntities(m[1] || '').trim());
  }
  for (const m of s.matchAll(/data-page\s*=\s*'([^']+)'/gi)) {
    scriptJson.push(decodeHtmlEntities(m[1] || '').trim());
  }

  // <script type="application/json" id="__NEXT_DATA__">{...}</script>
  // Be permissive about attribute ordering.
  for (const m of s.matchAll(/<script[^>]*__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/gi)) {
    scriptJson.push(m[1] || '');
  }

  // <script type="application/ld+json">{...}</script>
  for (const m of s.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    scriptJson.push(m[1] || '');
  }

  // Generic JSON-ish script blocks that mention transcript.
  if (/transcript/i.test(s)) {
    for (const m of s.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
      const body = m[1] || '';
      if (/transcript/i.test(body)) scriptJson.push(body);
    }
  }

  for (const raw of scriptJson) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) continue;

    // Try JSON.parse first.
    let parsed = null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Best-effort: extract a JSON object/array substring.
      const obj = trimmed.match(/({[\s\S]*})/);
      const arr = trimmed.match(/(\[[\s\S]*\])/);
      const candidate = (obj && obj[1]) || (arr && arr[1]) || '';
      if (candidate) {
        try {
          parsed = JSON.parse(candidate);
        } catch {
          parsed = null;
        }
      }
    }

    if (!parsed) continue;
    
    const found = findTranscriptInObject(parsed);
    if (found) return found;
  }

  return '';
}

function extractDateFromHtml(html) {
  const s = String(html);

  // Common OpenGraph / Schema.org fields.
  const metaDate =
    extractMetaContent(s, { property: 'og:video:release_date' }) ||
    extractMetaContent(s, { property: 'video:release_date' }) ||
    extractMetaContent(s, { property: 'og:published_time' }) ||
    extractMetaContent(s, { property: 'article:published_time' }) ||
    extractMetaContent(s, { name: 'date' }) ||
    extractMetaContent(s, { itemprop: 'datePublished' }) ||
    extractMetaContent(s, { itemprop: 'uploadDate' }) ||
    '';

  if (metaDate) return metaDate;

  // JSON-LD is common on video share pages.
  // Look for "uploadDate": "2024-..." or "datePublished": "..."
  const jsonDate = s.match(/"(?:uploadDate|datePublished|dateCreated|dateModified)"\s*:\s*"([^"]+)"/i);
  if (jsonDate && jsonDate[1]) return jsonDate[1];

  // Fathom specific: sometimes in a data attribute or script.
  // But often Fathom puts the date in the title or a subtitle like "Recorded on Jan 1, 2024".
  // We'll stick to standard metadata for now to avoid fragility.

  return '';
}

export function normalizeFetchedContent(content, baseUrl = null) {
  const s = String(content || '').trim();
  if (!s) return { text: '', suggestedTitle: '', mediaUrl: '', date: '' };
  const looksHtml = /<\s*html[\s>]/i.test(s) || /<\s*title[\s>]/i.test(s);
  if (!looksHtml) return { text: s, suggestedTitle: '', mediaUrl: '', date: '' };

  let mediaUrl = extractVideoUrlFromHtml(s);
  mediaUrl = resolveMaybeRelativeUrl(mediaUrl, baseUrl);
  const date = extractDateFromHtml(s);
  const description = extractDescriptionFromHtml(s);
  const screenshot = extractScreenshotFromHtml(s);
  const author = resolveAuthor(s);

  // If a share page embeds a transcript/notes in JSON, prefer that over tag-stripping.
  const embeddedTranscript = tryExtractTranscriptFromEmbeddedJson(s);
  if (embeddedTranscript) {
    return { text: embeddedTranscript, suggestedTitle: extractTitleFromHtml(s), mediaUrl, date, description, author, screenshot };
  }

  const stripped = stripHtmlToText(s);
  const slicedTranscript = sliceLikelyTranscript(stripped);
  return {
    text: slicedTranscript || stripped,
    suggestedTitle: extractTitleFromHtml(s),
    mediaUrl,
    date,
    description,
    author,
    screenshot
  };
}

export async function fetchUrlText(url, { cookie = null, referer = null, timeoutMs = null, userAgent = null } = {}) {
  const controller = new AbortController();
  const ms = timeoutMs != null ? Number(timeoutMs) : Number(process.env.FATHOM_FETCH_TIMEOUT_MS || 15_000);
  const t = setTimeout(() => controller.abort(), Number.isFinite(ms) ? ms : 15_000);
  try {
    const headers = {
      'user-agent': resolveUserAgent(userAgent)
    };
    const c = normalizeCookie(cookie);
    if (c) headers.cookie = c;
    if (referer) headers.referer = String(referer);

    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers
    });

    if (!res.ok) {
      const hint =
        res.status === 401 || res.status === 403
          ? ' (auth required; pass FATHOM_COOKIE or --cookie-file)'
          : '';
      return { ok: false, error: `HTTP ${res.status}${hint}` };
    }

    const text = await res.text();
    return { ok: true, text };
  } catch (e) {
    const msg = String(e?.name === 'AbortError' ? 'timeout' : (e?.message || e));
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function defaultArtifactsDir({ title } = {}) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const base = slugify(title) || 'fathom';
  return path.join(process.cwd(), 'fathom-artifacts', `${ts}-${base}`);
}

function envInt(name, fallback) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function ffmpegDownloadTimeoutMs() {
  // Default: 2 hours (long calls + HLS downloads can take a while).
  return envInt('FATHOM_FFMPEG_DOWNLOAD_TIMEOUT_SECONDS', 7200) * 1000;
}

function ffmpegSplitTimeoutMs() {
  // Default: 1 hour (re-encode fallback can be slower).
  return envInt('FATHOM_FFMPEG_SPLIT_TIMEOUT_SECONDS', 3600) * 1000;
}

function run(cmd, args, { timeoutMs = 5 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';

    const t = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (c) => (out += String(c)));
    child.stderr.on('data', (c) => (err += String(c)));

    child.on('error', (e) => {
      clearTimeout(t);
      // Provide a clearer hint for missing system dependencies (common in CI/dev boxes).
      if (e && (e.code === 'ENOENT' || String(e.message || '').includes('ENOENT'))) {
        const err = new Error(`${cmd} not found (is it installed and on PATH?)`);
        err.code = e.code;
        return reject(err);
      }
      reject(e);
    });

    child.on('close', (code) => {
      clearTimeout(t);
      if (code === 0) return resolve({ out, err });
      const tail = (err || out || '').split(/\r?\n/).slice(-20).join('\n');
      reject(new Error(`${cmd} exited ${code}: ${tail}`));
    });
  });
}

function normalizeCookie(cookie) {
  if (!cookie) return null;
  let c = String(cookie).trim();
  if (!c) return null;
  if (c.toLowerCase().startsWith('cookie:')) c = c.slice('cookie:'.length).trim();
  return c || null;
}

async function ffprobeLooksValidMp4(filePath) {
  try {
    // If the file is incomplete (e.g. process killed), ffprobe commonly fails with "moov atom not found".
    await run(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'default=nw=1:nk=1', String(filePath)],
      { timeoutMs: 30_000 }
    );
    return true;
  } catch {
    return false;
  }
}

async function downloadMediaWithFfmpeg({ mediaUrl, outPath, cookie, referer = null, userAgent = null } = {}) {
  if (!mediaUrl) throw new Error('mediaUrl is required');
  if (!outPath) throw new Error('outPath is required');

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const common = ['-y', '-loglevel', 'error'];
  const ua = resolveUserAgent(userAgent);
  const c = normalizeCookie(cookie);

  // Prefer dedicated flags where available.
  const httpArgs = ['-user_agent', ua];
  if (referer) httpArgs.push('-referer', String(referer));

  // Some servers only honor headers passed via -headers, so keep Cookie here.
  const headerArgs = c ? ['-headers', `Cookie: ${c}\r\n`] : [];

  // Fast path: stream-copy.
  try {
    await run(
      'ffmpeg',
      [
        ...common,
        ...httpArgs,
        ...headerArgs,
        '-i',
        mediaUrl,
        '-c',
        'copy',
        // When remuxing to MP4, ensure we write a proper moov atom.
        '-movflags',
        '+faststart',
        // Common when ingesting HLS/TS into MP4.
        '-bsf:a',
        'aac_adtstoasc',
        outPath
      ],
      { timeoutMs: ffmpegDownloadTimeoutMs() }
    );

    // Guard: if the process was killed mid-flight in a previous run, we can end up with a "moov atom not found" mp4.
    // Validate and force a re-encode fallback if needed.
    if (!(await ffprobeLooksValidMp4(outPath))) {
      throw new Error('downloaded mp4 looks invalid (ffprobe failed; likely missing moov); retrying with re-encode');
    }

    return { ok: true, outPath, method: 'copy' };
  } catch {
    // Fallback: re-encode (more robust across containers/streams).
    await run(
      'ffmpeg',
      [
        ...common,
        ...httpArgs,
        ...headerArgs,
        '-i',
        mediaUrl,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '28',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outPath
      ],
      { timeoutMs: ffmpegDownloadTimeoutMs() }
    );
    return { ok: true, outPath, method: 'reencode' };
  }
}

function isLikelyMediaFile(url) {
  const raw = String(url || '').trim();
  if (!raw) return false;

  // Many CDNs sign media URLs via query params, so `.endsWith('.mp4')` is too strict.
  // Example: https://cdn.example.com/video.mp4?token=abc
  const lower = raw.toLowerCase();
  const noQuery = lower.split(/[?#]/)[0];

  return (
    noQuery.endsWith('.mp4') ||
    noQuery.endsWith('.mov') ||
    noQuery.endsWith('.m4v') ||
    noQuery.endsWith('.webm') ||
    noQuery.endsWith('.m3u8')
  );
}

async function probeIsMediaUrl(url, { cookie = null, referer = null, userAgent = null } = {}) {
  const u = String(url || '').trim();
  if (!u || !/^https?:\/\//i.test(u)) return false;

  const headers = {};
  const ua = resolveUserAgent(userAgent);
  headers['user-agent'] = ua;
  if (referer) headers.referer = String(referer);
  const c = normalizeCookie(cookie);
  if (c) headers.cookie = c;

  // Prefer HEAD when supported; fall back to a tiny GET.
  async function check(res) {
    const ct = String(res.headers.get('content-type') || '').toLowerCase();
    return (
      ct.startsWith('video/') ||
      ct.includes('application/vnd.apple.mpegurl') ||
      ct.includes('application/x-mpegurl') ||
      ct.includes('audio/')
    );
  }

  try {
    const res = await fetch(u, { method: 'HEAD', redirect: 'follow', headers });
    if (res.ok) return await check(res);
  } catch {
    // ignore
  }

  try {
    // Fallback GET: request only the first byte to avoid accidentally downloading large media.
    // Many servers honor Range; if they ignore it, we still bail based on content-type.
    const res = await fetch(u, { method: 'GET', redirect: 'follow', headers: { ...headers, range: 'bytes=0-0' } });
    const ok = res.ok ? await check(res) : false;
    try { res.body?.cancel?.(); } catch {}
    return ok;
  } catch {
    return false;
  }
}

async function resolveMediaUrl(mediaUrl, { cookie = null, referer = null, userAgent = null, maxDepth = 3 } = {}) {
  const start = String(mediaUrl || '').trim();
  if (!start) return '';

  // Special case: HLS playlists often have a corresponding direct mp4 endpoint (much faster to download).
  // Example: .../video.m3u8 -> .../video.mp4
  if (/\.m3u8(\?|$)/i.test(start)) {
    const mp4 = start.replace(/\.m3u8(\?|$)/i, '.mp4$1');
    if (mp4 !== start) {
      try {
        if (await probeIsMediaUrl(mp4, { cookie, referer, userAgent })) return mp4;
      } catch {
        // ignore
      }
    }
  }

  if (isLikelyMediaFile(start)) return start;

  // Some providers serve media endpoints without a file extension.
  // Quick probe: if the URL itself returns a video/mpegurl content-type, treat it as the final media URL.
  if (await probeIsMediaUrl(start, { cookie, referer, userAgent })) return start;

  if (maxDepth <= 0) return start;

  // Some share pages point og:video at an embeddable player HTML.
  // Best-effort: fetch that page and look again for a direct video URL.
  const fetched = await fetchUrlText(start, { cookie, referer });
  if (!fetched.ok) return start;

  const nextRaw = extractVideoUrlFromHtml(fetched.text) || '';
  const next = resolveMaybeRelativeUrl(nextRaw, start);
  if (!next) return start;
  if (next === start) return start;
  if (isLikelyMediaFile(next)) return next;

  // One more hop (guarded).
  return resolveMediaUrl(next, { cookie, referer: start, userAgent, maxDepth: maxDepth - 1 });
}

async function splitVideoIntoSegments({ inputPath, segmentsDir, segmentSeconds = 300 } = {}) {
  if (!inputPath) throw new Error('inputPath is required');
  if (!segmentsDir) throw new Error('segmentsDir is required');
  if (!Number.isFinite(segmentSeconds) || segmentSeconds <= 0) throw new Error('segmentSeconds must be > 0');

  fs.mkdirSync(segmentsDir, { recursive: true });
  const pattern = path.join(segmentsDir, 'segment_%03d.mp4');
  const common = ['-y', '-loglevel', 'error'];

  // Fast path: stream-copy (segments align to keyframes; good enough for Gemini ingestion).
  try {
    await run(
      'ffmpeg',
      [
        ...common,
        '-i',
        inputPath,
        '-map',
        '0',
        '-c',
        'copy',
        '-f',
        'segment',
        '-segment_time',
        String(segmentSeconds),
        '-reset_timestamps',
        '1',
        pattern
      ],
      { timeoutMs: ffmpegSplitTimeoutMs() }
    );
  } catch (err) {
    console.warn(`[extractor] warning: fast split failed, falling back to re-encode (${String(err.message || err).split('\\n')[0]})`);
    // Fallback: re-encode + force keyframes at segment boundaries.
    await run(
      'ffmpeg',
      [
        ...common,
        '-i',
        inputPath,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '28',
        '-force_key_frames',
        `expr:gte(t,n_forced*${segmentSeconds})`,
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-f',
        'segment',
        '-segment_time',
        String(segmentSeconds),
        '-reset_timestamps',
        '1',
        pattern
      ],
      { timeoutMs: ffmpegSplitTimeoutMs() }
    );
  }

  const files = fs
    // Keep in deterministic order.
    .readdirSync(segmentsDir)
    .filter((f) => f.startsWith('segment_') && f.endsWith('.mp4'))
    .sort()
    .map((f) => path.join(segmentsDir, f));

  return files;
}

export function extractTranscriptUrlFromHtml(html, pageUrl) {
  const s = decodeHtmlEntities(String(html || '')).replaceAll('\\/', '/');

  // Fathom: copyTranscriptUrl in JSON state
  const m = s.match(/copyTranscriptUrl"\s*:\s*"([^"\s]+\/copy_transcript[^"\s]*)"/i);
  if (m && m[1]) return resolveMaybeRelativeUrl(m[1], pageUrl);

  // Fathom: direct copy_transcript URL match
  const m2 = s.match(/https?:\/\/[^\s"'<>]+\/copy_transcript\b[^\s"'<>]*/i);
  if (m2 && m2[0]) return m2[0];

  // Loom: VTT captions in JSON state (often "url": "....vtt")
  // Look for .vtt url inside quotes.
  // We prefer english captions if possible, but any VTT is better than nothing.
  const vttMatches = s.matchAll(/"([^"]+\.vtt[^"]*)"/gi);
  const candidates = [];
  for (const match of vttMatches) {
    if (match[1]) candidates.push(match[1]);
  }

  if (candidates.length) {
    // Prioritize English (common patterns: _en.vtt, /en/, -en.vtt)
    const en = candidates.find((c) => /[-_]en\.vtt/i.test(c) || /\/en\//i.test(c));
    return resolveMaybeRelativeUrl(en || candidates[0], pageUrl);
  }

  return '';
}

async function fetchTranscriptContent(transcriptUrl, { cookie = null, referer = null, userAgent = null } = {}) {
  const u = String(transcriptUrl || '').trim();
  if (!u) return '';

  const headers = {
    'user-agent': resolveUserAgent(userAgent),
  };

  const c0 = normalizeCookie(cookie);
  if (c0) headers.cookie = c0;
  if (referer) headers.referer = String(referer);

  try {
    const res = await fetch(u, { method: 'GET', redirect: 'follow', headers });
    if (!res.ok) return '';

    const txt = await res.text();

    // Strategy A: Fathom "copy_transcript" endpoint returns JSON { html: "..." }
    if (u.includes('copy_transcript')) {
      let json;
      try { json = JSON.parse(txt); } catch { return ''; }
      const html = String(json?.html || '').trim();
      if (!html) return '';
      return stripHtmlToText(html);
    }

    // Strategy B: VTT file (Loom, etc.)
    // WEBVTT
    // 00:00:00.000 --> 00:00:02.000
    // Hello world
    if (txt.includes('WEBVTT') || u.endsWith('.vtt')) {
      // Simple VTT to Text converter
      return txt
        .replace(/^WEBVTT[^\n]*\n/g, '') // Remove header
        .replace(/(\d{2}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(\d{2}:)?\d{2}:\d{2}\.\d{3}[^\n]*/g, '') // Remove timestamps
        .replace(/^\d+\s*$/gm, '') // Remove sequence numbers
        .replace(/<[^>]+>/g, '') // Remove style tags
        .split('\n')
        .map(x => x.trim())
        .filter(x => x)
        .join(' '); // Join lines (VTT often breaks sentences)
    }

    // Fallback: assume plain text
    return txt.trim();
  } catch {
    return '';
  }
}

export async function extractFromUrl(
  url,
  {
    downloadMedia = false,
    splitSeconds = 300,
    outDir = null,
    cookie = null,
    referer = null,
    mediaOutPath = null,
    userAgent = null,
    timeoutMs = null,
  } = {}
) {
  const fetched = await fetchUrlText(url, { cookie, referer, userAgent, timeoutMs });
  if (fetched.ok) {
    const norm = normalizeFetchedContent(fetched.text, url);

    // Context-specific enrichment
    if (isLoomUrl(url)) {
      try {
        const oembed = await fetchLoomOembed(url);
        if (oembed) {
          if (oembed.title && !norm.suggestedTitle) norm.suggestedTitle = oembed.title;
          if (oembed.author_name && !norm.author) norm.author = oembed.author_name;
          if (oembed.thumbnail_url && !norm.screenshot) norm.screenshot = oembed.thumbnail_url;
        }
      } catch {
        // ignore
      }

      try {
        const meta = extractLoomMetadataFromHtml(fetched.text);
        if (meta) {
          if (meta.title && !norm.suggestedTitle) norm.suggestedTitle = meta.title;
          if (meta.description && !norm.description) norm.description = meta.description;
          if (meta.mediaUrl) norm.mediaUrl = meta.mediaUrl;
          if (meta.transcriptUrl) norm._loomTranscriptUrl = meta.transcriptUrl;
        }
      } catch {
        // ignore
      }

      try {
        const id = extractLoomId(url);
        if (id) {
          const session = await fetchLoomSession(id);
          if (session) {
            const found = findTranscriptInObject(session);
            if (found) norm._loomApiTranscript = found;
          }
        }
      } catch {
        // ignore
      }
    }

    if (isYoutubeUrl(url)) {
      try {
        const oembed = await fetchYoutubeOembed(url);
        if (oembed) {
          if (oembed.title && !norm.suggestedTitle) norm.suggestedTitle = oembed.title;
          if (oembed.author_name && !norm.author) norm.author = oembed.author_name;
          if (oembed.thumbnail_url && !norm.screenshot) norm.screenshot = oembed.thumbnail_url;
        }
      } catch {
        // ignore
      }
    }

    // If the page doesn't embed a transcript, prefer the real transcript endpoint when available.
    let transcriptText = norm.text;
    if (norm._loomApiTranscript) transcriptText = norm._loomApiTranscript;

    let transcriptUrl = extractTranscriptUrlFromHtml(fetched.text, url);
    if (norm._loomTranscriptUrl) transcriptUrl = norm._loomTranscriptUrl;

    const hasTimestamps = /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(String(transcriptText || ''));
    
    // Fetch if we have a URL and (no text OR text sucks).
    if ((!transcriptText || transcriptText.length < 300 || !hasTimestamps) && transcriptUrl) {
      const fetchedText = await fetchTranscriptContent(transcriptUrl, { cookie, referer: referer || url, userAgent });
      if (fetchedText) transcriptText = fetchedText;
    }

    const resolvedMediaUrl = await resolveMediaUrl(norm.mediaUrl || '', { cookie, referer: referer || url, userAgent, maxDepth: 3 });

    const base = {
      ok: true,
      source: url,
      text: transcriptText,
      mediaUrl: resolvedMediaUrl || '',
      title: norm.suggestedTitle || '',
      date: norm.date || '',
      description: norm.description || '',
      author: norm.author || '',
      screenshot: norm.screenshot || '',
      suggestedTitle: norm.suggestedTitle,
      fetchError: null,

      // Artifacts (optional)
      artifactsDir: null,
      transcriptPath: null,
      extractedJsonPath: null,

      // Media artifacts (optional)
      mediaPath: null,
      mediaSegmentsDir: null,
      mediaSegments: [],
      mediaSegmentsListPath: null,
      segmentSeconds: splitSeconds,
      mediaDownloadError: null,
    };

    // If the caller asked for an output dir, always produce file artifacts (transcript + extracted.json),
    // even when media download is disabled or mediaUrl is missing.
    const wantsArtifacts = Boolean(outDir || mediaOutPath || (downloadMedia && base.mediaUrl));

    if (wantsArtifacts) {
      const artifactsDir = mediaOutPath
        ? path.dirname(path.resolve(mediaOutPath))
        : outDir
          ? path.resolve(outDir)
          : defaultArtifactsDir({ title: base.title || base.suggestedTitle });

      base.artifactsDir = artifactsDir;
      fs.mkdirSync(artifactsDir, { recursive: true });

      base.transcriptPath = path.join(artifactsDir, 'transcript.txt');
      fs.writeFileSync(base.transcriptPath, base.text + '\n', 'utf8');

      base.extractedJsonPath = path.join(artifactsDir, 'extracted.json');
      // We'll fill this at the end once media fields are finalized.
    }

    // Optional: if we have a mediaUrl, download as an mp4 and split into N-second chunks.
    // If we *wanted* to download but couldn't find a mediaUrl, surface that clearly.
    if (downloadMedia && !base.mediaUrl) {
      base.mediaDownloadError = 'mediaUrl not found on share page (auth-gated pages may require FATHOM_COOKIE/--cookie-file)';
    }

    if (downloadMedia && base.mediaUrl && base.artifactsDir) {
      const videoPath = mediaOutPath ? path.resolve(mediaOutPath) : path.join(base.artifactsDir, 'video.mp4');
      const segmentsDir = path.join(base.artifactsDir, 'segments');
      base.mediaSegmentsDir = segmentsDir;

      try {
        await downloadMediaWithFfmpeg({ mediaUrl: base.mediaUrl, outPath: videoPath, cookie, referer: referer || url, userAgent });
        base.mediaPath = videoPath;

        if (splitSeconds && Number.isFinite(splitSeconds) && splitSeconds > 0) {
          base.mediaSegments = await splitVideoIntoSegments({
            inputPath: videoPath,
            segmentsDir,
            segmentSeconds: splitSeconds,
          });

          // Convenience artifact: a newline-delimited list of segment file paths for downstream ingestion.
          try {
            base.mediaSegmentsListPath = path.join(base.artifactsDir, 'segments.txt');
            fs.writeFileSync(base.mediaSegmentsListPath, base.mediaSegments.join('\n') + (base.mediaSegments.length ? '\n' : ''), 'utf8');
          } catch {
            // Non-fatal.
            base.mediaSegmentsListPath = null;
          }
        }
      } catch (e) {
        base.mediaDownloadError = String(e?.message || e);
      }
    }

    if (base.extractedJsonPath) {
      try {
        fs.writeFileSync(base.extractedJsonPath, JSON.stringify(base, null, 2) + '\n', 'utf8');
      } catch {
        // Non-fatal: still return JSON to stdout.
      }
    }

    return base;
  }

  const base = {
    ok: false,
    source: url,
    text: 'Unable to fetch this link (likely auth/cookies). If you already have transcript/notes, pipe them into: fathom2action --stdin',
    mediaUrl: '',
    title: 'Unable to fetch this link',
    date: '',
    description: '',
    author: '',
    screenshot: '',
    suggestedTitle: '',
    fetchError: fetched.error,
    artifactsDir: null,
    transcriptPath: null,
    extractedJsonPath: null,
    mediaPath: null,
    mediaSegmentsDir: null,
    mediaSegments: [],
    mediaSegmentsListPath: null,
    segmentSeconds: splitSeconds,
    mediaDownloadError: null,
  };

  // If the caller requested artifacts, still write a stub transcript + extracted.json.
  // This keeps the "extract → transform" workflow usable even when the share link is auth-gated.
  if (outDir) {
    try {
      const artifactsDir = path.resolve(outDir);
      base.artifactsDir = artifactsDir;
      fs.mkdirSync(artifactsDir, { recursive: true });

      base.transcriptPath = path.join(artifactsDir, 'transcript.txt');
      const stub = [
        base.text,
        '',
        `Fetch error: ${base.fetchError}`,
        'Tip: pass FATHOM_COOKIE (Cookie header) or FATHOM_COOKIE_FILE/--cookie-file to access auth-gated links.',
      ].join('\n');
      fs.writeFileSync(base.transcriptPath, stub.trimEnd() + '\n', 'utf8');

      base.extractedJsonPath = path.join(artifactsDir, 'extracted.json');
      fs.writeFileSync(base.extractedJsonPath, JSON.stringify(base, null, 2) + '\n', 'utf8');
    } catch {
      // Non-fatal: still return JSON to stdout.
    }
  }

  return base;
}

export function extractFromStdin({ content, source }) {
  const raw = String(content || '').trim();
  if (!raw) {
    const err = new Error('stdin is empty');
    err.code = 2;
    throw err;
  }

  // Convenience: allow pasting a URL as the first line, followed by optional Title, followed by transcript.
  // Example:
  //   https://fathom.video/share/...
  //   Title: Login breaks on Safari
  //   00:01 Alice: ...
  let src = source || 'stdin';
  let title = '';

  const lines = raw.split(/\r?\n/);

  let idx = 0;

  function takeTitle(line) {
    // Some copy/pastes come from quoted contexts (email/Slack) where each line starts with "> ".
    // Strip a single leading quote marker for robustness.
    const s = String(line || '').trim().replace(/^>+\s*/, '');
    if (!s) return null;
    const m = s.match(/^(?:title|subject|topic)\s*(?:[:=\-–—])\s*(.*)$/i);
    if (m) return String(m[1] || '').trim();

    // Markdown headings are common in copy/paste “envelopes”.
    // Support # Title, ## Title, ### Title, etc.
    const h = s.match(/^#+\s+(.+)$/);
    if (h) return String(h[1] || '').trim();

    return null;
  }

  function takeDescription(line) {
    const s = String(line || '').trim().replace(/^>+\s*/, '');
    if (!s) return null;
    const m = s.match(/^(?:description|summary)\s*(?:[:=\-–—])\s*(.*)$/i);
    if (m) return String(m[1] || '').trim();
    return null;
  }

  function takeSource(line) {
    // Some copy/pastes come from quoted contexts (email/Slack) where each line starts with "> ".
    // Strip a single leading quote marker for robustness.
    const s0 = String(line || '').trim().replace(/^>+\s*/, '');
    if (!s0) return null;

    // Allow a "Source:" prefix (common in briefs) as well as a bare URL.
    // Also accept chat/markdown-wrapped URLs (angle brackets, Slack <url|label>, markdown links, etc.).
    // Keep parsing logic centralized via normalizeUrlLike() to avoid drift vs brief rendering.
    function cleanUrl(u) {
      return normalizeUrlLike(String(u || ''));
    }

    // Accept common label prefixes with either a colon or dash separator:
    //   Source: https://...
    //   Source - https://...
    //   Link — https://...
    const sourcePrefixed = s0.match(
      /^(?:source|fathom(?:\s*link)?|share(?:\s*link)?|link|url|recording|video(?:\s*link)?|meeting|call|(?:google\s*meet|meet)(?:\s*link)?|(?:(?:microsoft|ms)\s*)?teams(?:\s*link)?|zoom(?:\s*link)?|webex(?:\s*link)?|jitsi(?:\s*link)?|loom(?:\s*link)?)\s*(?:[:=\-–—])\s*(.*)\s*$/i
    );
    if (sourcePrefixed) {
      const u = cleanUrl(sourcePrefixed[1]);
      if (/^https?:\/\//i.test(u)) return u;
      // Matched the prefix but no valid URL found?
      // Consume the line (return empty string) so we don't leak "Source: " into the transcript.
      return '';
    }

    const bare = cleanUrl(s0);
    if (/^https?:\/\//i.test(bare)) return bare;

    return null;
  }

  function takeDate(line) {
    const s = String(line || '').trim().replace(/^>+\s*/, '');
    if (!s) return null;

    // Date: 2025-01-30
    const m = s.match(/^(?:date|time|when)\s*[:=\-–—]\s*(.*)$/i);
    if (m) return String(m[1] || '').trim();

    // Bare YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    return null;
  }

  function takeAuthor(line) {
    const s = String(line || '').trim().replace(/^>+\s*/, '');
    if (!s) return null;
    const m = s.match(/^(?:author|who|by)\s*[:=\-–—]\s*(.*)$/i);
    if (m) return String(m[1] || '').trim();
    return null;
  }

  let date = '';
  let author = '';
  let description = '';

  // Consume metadata headers until we hit content.
  // We stop if we encounter a line that isn't a recognized header and isn't empty.
  // (Empty lines are skipped).
  while (idx < lines.length) {
    const line = String(lines[idx] || '').trim();
    if (!line) {
      idx++;
      continue;
    }

    let matched = false;

    // 1. Source (URL or Source: ...)
    const s = takeSource(line);
    if (s !== null) {
      src = s;
      date = date; // keep existing if any
      idx++;
      continue;
    }

    // 2. Title (Title: ... or # ...)
    const t = takeTitle(line);
    if (t !== null) {
      title = t;
      idx++;
      continue;
    }

    // 2.5 Description
    const desc = takeDescription(line);
    if (desc !== null) {
      description = desc;
      idx++;
      continue;
    }

    // 3. Date (Date: ... or YYYY-MM-DD)
    const d = takeDate(line);
    if (d !== null) {
      date = d;
      idx++;
      continue;
    }

    // 4. Author
    const a = takeAuthor(line);
    if (a !== null) {
      author = a;
      idx++;
      continue;
    }

    // If nothing matched, we assume it's the start of the transcript/notes.
    break;
  }

  const text = lines.slice(idx).join('\n').trim();

  return {
    ok: true,
    source: src,
    text,
    mediaUrl: '',
    title,
    date,
    description,
    author,
    screenshot: '',
    suggestedTitle: '',
    fetchError: null,
    artifactsDir: null,
    transcriptPath: null,
    extractedJsonPath: null,
    mediaPath: null,
    mediaSegments: [],
    mediaSegmentsListPath: null,
    segmentSeconds: 0,
    mediaDownloadError: null,
  };
}

export function formatCsv(data) {
  const fields = ['date', 'title', 'source', 'mediaUrl', 'description', 'screenshot', 'text'];
  return fields.map((k) => {
    let val = String(data[k] || '');
    if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
      val = '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  }).join(',');
}

export function resolveAuthor(html) {
  const s = String(html || '');
  return (
    extractMetaContent(s, { name: 'author' }) ||
    extractMetaContent(s, { property: 'article:author' }) ||
    extractMetaContent(s, { name: 'twitter:creator' }) ||
    null
  );
}
