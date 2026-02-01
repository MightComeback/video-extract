import { JSDOM } from 'jsdom';
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { exec } from 'child_process';
import util from 'util';
import { extractLoomMetadataFromHtml, isLoomUrl, parseLoomTranscript, fetchLoomOembed } from './providers/loom.js';
import { isYoutubeUrl, extractYoutubeMetadataFromHtml, fetchYoutubeOembed, fetchYoutubeMediaUrl } from './providers/youtube.js';
import { isVimeoUrl, extractVimeoMetadataFromHtml } from './providers/vimeo.js';
import { extractFathom, isFathomUrl } from './providers/fathom.js';
import { parseSimpleVtt, downloadMedia } from './utils.js';

const execAsync = util.promisify(exec);

export function findTranscriptInObject(obj) {
  if (!obj) return '';
  let items = [];
  if (Array.isArray(obj)) items = obj;
  else if (obj.transcript && Array.isArray(obj.transcript)) items = obj.transcript;
  else if (obj.captions && Array.isArray(obj.captions)) items = obj.captions;
  
  if (!items.length) return '';

  return items.map(item => {
    const time = (item.startTime !== undefined) ? item.startTime : (item.start || 0);
    const text = item.text || '';
    
    // Format time hh:mm:ss or mm:ss
    const s = Math.floor(time);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sc = s % 60;
    const ts = h > 0 
      ? `${h}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}` 
      : `${m}:${String(sc).padStart(2, '0')}`;
    
    return `${ts}: ${text}`;
  }).join('\n');
}

export function extractTranscriptUrlFromHtml(html, sourceUrl) {
    if (!html) return '';
    
    // Regex to find VTT urls inside JSON or variables
    // Simple heuristic: looks for https://... .vtt
    const invalidExtensions = ['.js', '.css', '.png', '.jpg'];
    // Capture URL that ends with .vtt optionally with query params
    const regex = /https?:\/\/[^"\s']+\.vtt(?:[^"\s']*)?/gi;
    const matches = html.match(regex);
    
    if (!matches || matches.length === 0) return '';
    
    // De-duplicate
    const unique = [...new Set(matches)];
    
    // Filter out obvious noise if any (though regex is specific to .vtt)
    const valid = unique.filter(u => !u.includes('example.com') && !u.includes('localhost'));
    
    if (valid.length === 0) return '';

    // Priority 1: _en.vtt
    const en = valid.find(u => u.includes('_en.vtt') || u.includes('-en.vtt'));
    if (en) return en;
    
    // Priority 2: Return first found
    return valid[0];
}

export async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    
    // Check if TTY, if so return empty (to avoid hanging) unless piped
    if (process.stdin.isTTY) {
        resolve('');
        return;
    }

    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
}

export function formatCsv(data) {
  // Simple CSV formatting
  const headers = ['date', 'title', 'sourceUrl', 'transcript', 'videoUrl'];
  const row = headers.map(h => {
    const val = data[h] || '';
    return `"${String(val).replace(/"/g, '""')}"`;
  });
  return row.join(',');
}

export function extractFromStdin({ content, source }) {
    // Basic wrapper to mock extraction result from stdin content
    return {
        title: 'Stdin Input',
        date: new Date().toISOString(),
        transcript: content,
        test: content, // alias
        videoUrl: null,
        sourceUrl: source || 'stdin'
    };
}

async function extractLoom(url, page) {
    console.log(`Navigating to ${url}...`);
    // Loom often requires significant time to hydrate Apollo state
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const content = await page.content();
    
    // Try to extract via metadata (robust)
    let meta = extractLoomMetadataFromHtml(content);

    // Fallback: use OEmbed if metadata is missing critical fields
    if (!meta || !meta.title) {
        try {
            const oembed = await fetchLoomOembed(url);
            if (oembed) {
                meta = meta || {};
                if (!meta.title) meta.title = oembed.title;
                if (!meta.author) meta.author = oembed.author_name;
                if (!meta.thumbnailUrl) meta.thumbnailUrl = oembed.thumbnail_url;
                if (!meta.duration && oembed.duration) meta.duration = oembed.duration;
            }
        } catch (e) {
            console.warn('Failed to fetch Loom OEmbed:', e);
        }
    }
    
    // Fallback/Enhancement with DOM if meta is incomplete
    const dom = new JSDOM(content);
    const document = dom.window.document;

    const title = meta?.title || 
                  document.querySelector('h1')?.textContent?.trim() || 
                  document.title.replace(' | Loom', '').trim() || 
                  'Loom Recording';

    const date = meta?.date || new Date().toISOString();

    let transcript = meta?.transcriptText || '';
    
    if (!transcript) {
        let tUrl = meta?.transcriptUrl;
        if (!tUrl) {
             tUrl = extractTranscriptUrlFromHtml(content, url);
        }

        if (tUrl) {
            try {
                console.log(`Fetching transcript from ${tUrl}...`);
                const res = await fetch(tUrl);
                if (res.ok) {
                    const txt = await res.text();
                    transcript = parseLoomTranscript(txt);
                }
            } catch (e) {
                console.warn('Failed to fetch transcript:', e);
            }
        }
    }
    
    if (!transcript) {
        // Fallback DOM scraping for transcript
        const transcriptContainer = document.querySelector('[class*="transcript-container"]') || 
                                    document.querySelector('#transcript-panel');
        if (transcriptContainer) {
             transcript = transcriptContainer.textContent.trim();
        }
    }

    const videoUrl = meta?.mediaUrl || null;

    return {
        title,
        date,
        transcript: transcript || "(Loom transcript extraction requires authenticaton or specific DOM selectors)", 
        videoUrl,
        sourceUrl: url,
        author: meta?.author
    };
}

async function extractYoutube(url, page) {
    console.log(`Navigating to ${url}...`);
    // YouTube can be heavy; domcontentloaded is usually enough for metadata
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    const content = await page.content();
    let meta = extractYoutubeMetadataFromHtml(content);

    // Initial player response might be missing or obfuscated, try OEmbed fallback
    if (!meta || !meta.title) {
        try {
            const oembed = await fetchYoutubeOembed(url);
            if (oembed) {
                meta = meta || {};
                if (!meta.title) meta.title = oembed.title;
                if (!meta.author) meta.author = oembed.author_name;
                if (!meta.thumbnailUrl) meta.thumbnailUrl = oembed.thumbnail_url;
                // OEmbed does not provide duration or transcript, but title/author is better than nothing
            }
        } catch (e) {
            console.warn('Failed to fetch YouTube OEmbed:', e);
        }
    }

    let transcript = '';
    if (meta?.transcriptUrl) {
        try {
            console.log(`Fetching transcript from ${meta.transcriptUrl}...`);
            const res = await fetch(meta.transcriptUrl);
            if (res.ok) {
                 const txt = await res.text();
                 // Expecting VTT because we appended fmt=vtt
                 transcript = parseSimpleVtt(txt);
            }
        } catch (e) {
            console.warn('Failed to fetch YouTube transcript:', e);
        }
    }

    let directVideoUrl = null;
    try {
        directVideoUrl = await fetchYoutubeMediaUrl(url);
    } catch (e) {
        console.warn('Failed to resolve YouTube media stream:', e);
    }

    return {
        title: meta?.title || 'YouTube Video',
        date: meta?.date || new Date().toISOString(), 
        transcript: transcript || '(No transcript found)',
        videoUrl: directVideoUrl, 
        sourceUrl: url,
        author: meta?.author
    };
}

async function extractVimeo(url, page) {
    console.log(`Navigating to ${url}...`);
    // Vimeo often works well with simple domcontentloaded
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    const content = await page.content();
    const meta = extractVimeoMetadataFromHtml(content);

    let transcript = '';
    if (meta?.transcriptUrl) {
        try {
            console.log(`Fetching transcript from ${meta.transcriptUrl}...`);
            const res = await fetch(meta.transcriptUrl);
            if (res.ok) {
                 const txt = await res.text();
                 // Vimeo VTT
                 transcript = parseSimpleVtt(txt);
            }
        } catch (e) {
            console.warn('Failed to fetch Vimeo transcript:', e);
        }
    }

    return {
        title: meta?.title || 'Vimeo Video',
        date: new Date().toISOString(), 
        transcript: transcript || '(No transcript found)',
        videoUrl: meta?.mediaUrl || null, 
        sourceUrl: url,
        author: meta?.author
    };
}

export async function extractFromUrl(url, options = {}) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    // Set a realistic User-Agent to avoid detection/blocking by some providers
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    let data;
    if (isYoutubeUrl(url)) {
        data = await extractYoutube(url, page);
    } else if (isVimeoUrl(url)) {
        data = await extractVimeo(url, page);
    } else if (isLoomUrl(url)) {
        data = await extractLoom(url, page);
    } else {
        // Default to Fathom or generic extraction
        data = await extractFathom(url, page);
    }

    if (options.downloadMedia && data.videoUrl) {
        const outDir = options.outDir || '.';
        const safeTitle = (data.title || 'video').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '');
        const filename = `${safeTitle}.mp4`;
        const destPath = join(outDir, filename);
        console.log(`Downloading video from ${data.videoUrl} to ${destPath}...`);
        await downloadMedia(data.videoUrl, destPath);
    }

    return data;

  } catch (error) {
    console.error('Error extracting data:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Re-export old name for backward compat
export const extractFathomData = extractFromUrl; 

export function normalizeFetchedContent(html, sourceUrl) {
    if (!html) return { suggestedTitle: '', description: '', text: '' };
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    // Title
    let title = doc.querySelector('meta[property="og:title"]')?.content || 
                doc.querySelector('meta[name="twitter:title"]')?.content || 
                doc.querySelector('title')?.textContent || 
                doc.querySelector('h1')?.textContent || '';
    
    // Description
    const description = doc.querySelector('meta[property="og:description"]')?.content ||
                        doc.querySelector('meta[name="description"]')?.content || 
                        doc.querySelector('meta[name="twitter:description"]')?.content || '';

    // Text extraction with <br> handling
    const body = doc.body;
    let text = '';
    if (body) {
        const brs = body.querySelectorAll('br');
        brs.forEach(br => br.replaceWith('\n'));
        text = body.textContent.trim();
    }

    return {
        suggestedTitle: title.trim(),
        description: description.trim(),
        text: text
    };
}
