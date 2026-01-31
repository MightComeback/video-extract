import { JSDOM } from 'jsdom';
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { exec } from 'child_process';
import util from 'util';
import { extractLoomMetadataFromHtml } from './loom.js';

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
    
    // Format time mm:ss
    const s = Math.floor(time);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    const ts = `${mm}:${String(ss).padStart(2, '0')}`;
    
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

async function extractFathom(url, page) {
    // Navigate and wait for content to load
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    try {
        await page.waitForSelector('[data-testid="transcript-container"], video', { timeout: 15000 });
    } catch (e) {
        console.warn("Timed out waiting for transcript or video selector. Continuing with current DOM state.");
    }

    const content = await page.content();
    const dom = new JSDOM(content);
    const document = dom.window.document;

    const title = document.querySelector('h1')?.textContent?.trim() || 
                  document.title.replace(' | Fathom', '').trim() || 
                  'Fathom Recording';
    
    const date = document.querySelector('time')?.getAttribute('datetime') || 
                 new Date().toISOString();

    const transcriptBlocks = [];
    const transcriptContainer = document.querySelector('[data-testid="transcript-container"]') || 
                                document.querySelector('.transcript-content');
    
    if (transcriptContainer) {
      const textNodes = Array.from(transcriptContainer.querySelectorAll('p, div[role="listitem"]'));
      textNodes.forEach(node => {
          const text = node.textContent.trim();
          if (text) transcriptBlocks.push(text);
      });
    }

    const transcript = transcriptBlocks.join('\n\n');

    let videoUrl = null;
    const videoEl = document.querySelector('video');
    if (videoEl) {
        videoUrl = videoEl.src || videoEl.querySelector('source')?.src;
    }

    return { title, date, transcript, videoUrl, sourceUrl: url };
}

async function extractLoom(url, page) {
    console.log(`Navigating to ${url}...`);
    // Loom often requires significant time to hydrate Apollo state
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    const content = await page.content();
    
    // Try to extract via metadata (robust)
    const meta = extractLoomMetadataFromHtml(content);
    
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

export async function extractFromUrl(url, options = {}) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    let data;
    if (url.includes('loom.com')) {
        data = await extractLoom(url, page);
    } else {
        data = await extractFathom(url, page);
    }

    if (options.downloadMedia && data.videoUrl) {
        // Download logic would go here
        // Using ffmpeg or curl
        // For now, just logging
        console.log(`[Mock] Downloading video from ${data.videoUrl} to ${options.outDir || '.'}`);
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
