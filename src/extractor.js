import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { normalizeUrlLike } from './brief.js';
import { parseSimpleVtt } from './utils.js';
import { extractFathomTranscriptUrl } from './providers/fathom.js';
import { isYoutubeUrl, isYoutubeClipUrl, extractYoutubeIdFromClipHtml, extractYoutubeMetadataFromHtml, fetchYoutubeOembed, fetchYoutubeMediaUrl } from './providers/youtube.js';
import { isVimeoUrl, extractVimeoMetadataFromHtml, fetchVimeoOembed, parseVimeoTranscript } from './providers/vimeo.js';
import { isLoomUrl, extractLoomMetadataFromHtml, fetchLoomOembed, parseLoomTranscript } from './providers/loom.js';

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

function parseTimestampToSeconds(input) {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!s) return null;

  // Accept plain seconds ("90"), or hh:mm:ss, or mm:ss
  const m = s.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = m[3] !== undefined ? Number(m[3]) : null;
    if (c === null) {
      // mm:ss
      return a * 60 + b;
    }
    // hh:mm:ss
    return a * 3600 + b * 60 + c;
  }

  const n = Number(s.replace(/s$/i, ''));
  if (Number.isFinite(n)) return n;
  return null;
}

function ffmpegClip({ inPath, outPath, fromSeconds, toSeconds, durationSeconds }) {
  return new Promise((resolve, reject) => {
    const start = Math.max(0, Number(fromSeconds) || 0);
    let dur = durationSeconds !== undefined && durationSeconds !== null ? Number(durationSeconds) : null;
    if ((dur === null || !Number.isFinite(dur) || dur <= 0) && toSeconds !== undefined && toSeconds !== null) {
      const end = Number(toSeconds);
      if (Number.isFinite(end) && end > start) dur = end - start;
    }
    if (!Number.isFinite(dur) || dur <= 0) return reject(new Error('Invalid clip duration (use --clip-to or --clip-seconds)'));

    const tryCopy = () => {
      const args = ['-y', '-loglevel', 'error', '-ss', String(start), '-i', inPath, '-t', String(dur), '-c', 'copy', outPath];
      const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      child.stderr.on('data', (d) => (err += String(d)));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) return resolve(outPath);
        // Fallback: re-encode for accuracy when start isn't a keyframe.
        const args2 = [
          '-y',
          '-loglevel',
          'error',
          '-ss',
          String(start),
          '-i',
          inPath,
          '-t',
          String(dur),
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '23',
          '-pix_fmt',
          'yuv420p',
          '-an',
          outPath,
        ];
        const child2 = spawn('ffmpeg', args2, { stdio: ['ignore', 'ignore', 'pipe'] });
        let err2 = '';
        child2.stderr.on('data', (d) => (err2 += String(d)));
        child2.on('error', reject);
        child2.on('close', (code2) => {
          if (code2 === 0) resolve(outPath);
          else reject(new Error(`ffmpeg clip failed (code ${code2}): ${(err2 || err).trim()}`));
        });
      });
    };

    tryCopy();
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
  let mediaUrlRejectReason = '';


  const resolveUrl = (maybeRelative, base) => {
    const v = String(maybeRelative || '').trim();
    if (!v) return '';
    try {
      // Handles absolute, protocol-relative, and relative URLs.
      return new URL(v, base).toString();
    } catch {
      return v;
    }
  };

  const { body: html } = await fetchText(url, { headers });
  const normalized = normalizeFetchedContent(html, url);

  let title = normalized.suggestedTitle || '';
  let text = normalized.text || '';
  const normalizedText = text;
  let mediaUrl = normalized.mediaUrl || '';

  // Provider-aware enrichment (Loom/YouTube/Vimeo) for better parity with Fathom.
  try {
    if (isLoomUrl(url)) {
      const meta = extractLoomMetadataFromHtml(html) || {};
      if (meta.title && !title) title = meta.title;

      // Fallback: oEmbed is lightweight and often works even when the HTML is behind auth/consent walls.
      if (!title) {
        const o = await fetchLoomOembed(url);
        if (o?.title) title = String(o.title);
      }

      // Loom transcript can be inlined in the Apollo state.
      if (meta.transcriptText && (!text || text === normalizedText)) {
        text = String(meta.transcriptText);
      }

      if (meta.transcriptUrl && (!text || text === normalizedText)) {
        const tUrl = resolveUrl(meta.transcriptUrl, url);
        const { body } = await fetchText(tUrl, { headers });
        text = /\.vtt(?:\?|#|$)/i.test(tUrl) ? parseSimpleVtt(body) : parseLoomTranscript(body);
      }

      if (meta.mediaUrl && !mediaUrl) mediaUrl = resolveUrl(meta.mediaUrl, url);
    } else if (isYoutubeUrl(url)) {
      const meta = extractYoutubeMetadataFromHtml(html) || {};
      if (meta.title && !title) title = meta.title;

      // Fallback: YouTube oEmbed can provide title/author even when ytInitialPlayerResponse isn't present.
      if (!title) {
        const o = await fetchYoutubeOembed(url);
        if (o?.title) title = String(o.title);
      }

      // Caption tracks are usually VTT.
      if (meta.transcriptUrl && (!text || text === normalizedText)) {
        try {
          const tUrl = resolveUrl(meta.transcriptUrl, url);
          const { body } = await fetchText(tUrl, { headers });
          text = parseSimpleVtt(body);
        } catch {
          // Best-effort only: transcript extraction shouldn't block media URL resolution.
        }
      }

      // Media URL: YouTube pages often expose an "embed"/player URL via meta tags (not a direct asset).
      // Use ytdl-core as a best-effort fallback to resolve a downloadable MP4.
      const shouldResolveMediaUrl = (() => {
        if (!mediaUrl) return true;
        try {
          const u = new URL(String(mediaUrl));
          const h = u.hostname.replace(/^www\./i, '').toLowerCase();
          return /(^|\.)youtube\.com$/.test(h) || /(^|\.)youtube-nocookie\.com$/.test(h) || h === 'youtu.be';
        } catch {
          return false;
        }
      })();

      if (shouldResolveMediaUrl) {
        const m = await fetchYoutubeMediaUrl(url);
        if (m) {
          mediaUrl = m;
        } else if (!mediaUrl) {
          // Clear failure mode: YouTube pages often only expose a player/embed URL.
          // If ytdl-core can't resolve a downloadable media URL, keep an actionable reason.
          mediaUrlRejectReason =
            'Unable to resolve a downloadable YouTube media URL (captions may still work). Try passing cookies for private/age-restricted videos or provide a different URL.';
        }
      }
    } else if (isVimeoUrl(url)) {
      const meta = extractVimeoMetadataFromHtml(html) || {};
      if (meta?.title && !title) title = meta.title;

      // Fallback: Vimeo oEmbed can provide title/author/thumbnail even when clip_page_config is missing.
      if (!title) {
        const o = await fetchVimeoOembed(url);
        if (o?.title) title = String(o.title);
      }

      if (meta?.mediaUrl && !mediaUrl) mediaUrl = resolveUrl(meta.mediaUrl, url);

      if (meta?.transcriptUrl && (!text || text === normalizedText)) {
        // Best-effort only: transcript extraction shouldn't block media URL resolution.
        try {
          const tUrl = resolveUrl(meta.transcriptUrl, url);
          const { body } = await fetchText(tUrl, { headers });

          text = parseVimeoTranscript(body);
        } catch {
          // ignore and fall back to the existing text
        }
      }
    }
  } catch {
    // Best effort only.
  }

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
      // Reject non-video URLs, but keep a helpful reason for the caller.
      mediaUrlRejectReason = `Resolved mediaUrl does not look like a video (content-type: ${ct || 'unknown'}): ${mediaUrl}`;
      mediaUrl = '';
    }
  }

  return {
    title,
    text,
    mediaUrl,
    mediaUrlRejectReason,
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

  const clipFromSeconds = parseTimestampToSeconds(options.clipFrom || options.clipFromSeconds);
  const clipToSeconds = parseTimestampToSeconds(options.clipTo || options.clipToSeconds);
  const clipSeconds = parseTimestampToSeconds(options.clipSeconds);
  const wantsClip = clipFromSeconds !== null || clipToSeconds !== null || clipSeconds !== null;

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
    clipFromSeconds: clipFromSeconds ?? null,
    clipToSeconds: clipToSeconds ?? null,
    clipSeconds: clipSeconds ?? null,
    clipPath: '',
    clipError: '',
  };

  // Ensure output dir exists early (so we can write stub artifacts even on fetch failures)
  if (outDir) ensureDir(outDir);

  try {
    // YouTube clip URLs (youtube.com/clip/...) don't include a stable 11-char video id.
    // Best-effort: fetch the clip page and try to resolve its underlying watch video id.
    // If we can't, fall back to a clear, actionable error.
    let fetchUrl = url;
    if (isYoutubeClipUrl(url)) {
      try {
        const clipEx = await bestEffortExtract({ url, cookie, referer, userAgent });
        const id = extractYoutubeIdFromClipHtml(clipEx?.html || '');

        if (id) {
          // Preserve time hints if they exist on the clip URL.
          let t = '';
          try {
            const u = new URL(normalizeUrlLike(url));
            t = u.searchParams.get('t') || u.searchParams.get('start') || '';
          } catch {
            // ignore
          }

          fetchUrl = `https://youtube.com/watch?v=${id}${t ? `&t=${encodeURIComponent(t)}` : ''}`;
          result.sourceUrl = fetchUrl;
        } else {
          throw new Error(
            'YouTube clip URLs are not supported (unable to resolve underlying video id). Open the clip and copy the full video URL (https://youtube.com/watch?v=...) instead.'
          );
        }
      } catch (e) {
        // If clip fetch itself fails, preserve the existing helpful guidance.
        throw new Error(
          `YouTube clip URLs are not supported. Open the clip and copy the full video URL (https://youtube.com/watch?v=...) instead. (${e?.message || e})`
        );
      }
    }

    const ex = await bestEffortExtract({ url: fetchUrl, cookie, referer, userAgent });
    result.ok = true;
    result.title = ex.title || '';
    result.text = ex.text || '';
    result.mediaUrl = ex.mediaUrl || '';

    // Clear failure mode: if we successfully fetched the page but couldn't extract any
    // meaningful transcript/body text, provide an actionable placeholder instead of an
    // empty transcript.txt.
    if (!String(result.text || '').trim()) {
      const lines = [
        'No transcript text was found for this link.',
        `Source: ${url}`,
        '',
        'If this link is auth-gated, pass cookies:',
        '- VIDEO_EXTRACT_COOKIE=... (or --cookie; compat: FATHOM_COOKIE)',
        '- VIDEO_EXTRACT_COOKIE_FILE=... (or --cookie-file; compat: FATHOM_COOKIE_FILE)',
      ];

      // Provider parity: Loom links frequently require a "sid" (session id) query param
      // for private shares. Cookies can also work.
      if (isLoomUrl(url)) {
        lines.push(
          '',
          'Loom notes:',
          '- For private Loom shares, ensure the URL includes ?sid=... (session id) or pass cookies.'
        );
      }

      if (isYoutubeUrl(url)) {
        lines.push(
          '',
          'YouTube notes:',
          '- Some videos have captions disabled/unavailable; if so, you may need to transcribe from the downloaded media.',
          '- Age-restricted/private videos may require cookies.'
        );
      }

      if (isVimeoUrl(url)) {
        lines.push(
          '',
          'Vimeo notes:',
          '- Unlisted Vimeo links require the hash ("h") — normalize to https://vimeo.com/<id>?h=<hash> if needed.',
          '- Private videos may require cookies.'
        );
      }

      result.text = lines.join('\n');
    }

    // If we rejected a candidate mediaUrl during enrichment/probing, preserve the reason
    // so downstream callers (and extracted.json) are actionable.
    if (!result.mediaUrl && ex.mediaUrlRejectReason) {
      result.mediaDownloadError = ex.mediaUrlRejectReason;
    }
  } catch (e) {
    result.ok = false;
    result.fetchError = e?.message || String(e);
    result.title = '';
    {
      const lines = [
        'Unable to fetch this link.',
        `Source: ${url}`,
        `Fetch error: ${result.fetchError}`,
        '',
        'If this link is auth-gated, pass cookies:',
        '- VIDEO_EXTRACT_COOKIE=... (or --cookie; compat: FATHOM_COOKIE)',
        '- VIDEO_EXTRACT_COOKIE_FILE=... (or --cookie-file; compat: FATHOM_COOKIE_FILE)',
      ];

      if (isLoomUrl(url)) {
        lines.push(
          '',
          'Loom notes:',
          '- For private Loom shares, ensure the URL includes ?sid=... (session id) or pass cookies.'
        );
      }

      if (isYoutubeUrl(url)) {
        lines.push(
          '',
          'YouTube notes:',
          '- Age-restricted/private videos may require cookies.'
        );
      }

      if (isVimeoUrl(url)) {
        lines.push(
          '',
          'Vimeo notes:',
          '- Unlisted Vimeo links require the hash ("h") — normalize to https://vimeo.com/<id>?h=<hash> if needed.',
          '- Private videos may require cookies.'
        );
      }

      result.text = lines.join('\n');
    }
  }

  // Write transcript.txt and extracted.json if outDir requested.
  if (outDir) {
    result.transcriptPath = path.join(outDir, 'transcript.txt');
    fs.writeFileSync(result.transcriptPath, String(result.text || ''), 'utf8');
  }

  // Download media (default ON)
  if (!noDownload) {
    if (!result.mediaUrl) {
      if (!result.mediaDownloadError) result.mediaDownloadError = 'mediaUrl not found';
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

        // Optional precise clip extraction (works for any provider as long as mediaUrl was resolved)
        if (wantsClip) {
          try {
            const from = clipFromSeconds ?? 0;
            const clipOut = options.clipOutPath || options.clipOut || path.join(outDir, `clip_${Math.floor(from)}s.mp4`);
            await ffmpegClip({
              inPath: mediaPath,
              outPath: clipOut,
              fromSeconds: from,
              toSeconds: clipToSeconds,
              durationSeconds: clipSeconds,
            });
            result.clipPath = clipOut;
          } catch (e) {
            result.clipError = e?.message || String(e);
          }
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
    if (!src && (
      /^https?:\/\//i.test(l) ||
      /\bfathom\.video\//i.test(l) ||
      /\bloom\.com\//i.test(l) ||
      /\b(?:(?:m\.|music\.)?youtube\.com|youtube-nocookie\.com|youtu\.be)\//i.test(l) ||
      /\bvimeo\.com\//i.test(l) ||
      /\bplayer\.vimeo\.com\//i.test(l)
    )) {
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
