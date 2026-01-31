#!/usr/bin/env node

import { JSDOM } from 'jsdom';
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Extracts metadata, transcript, and video URL from a Fathom recording.
 * Fathom recordings are rendered client-side, so Puppeteer is required.
 */
export async function extractFathomData(url, options = {}) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for running in stripped-down environments
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport to desktop size
    await page.setViewport({ width: 1280, height: 800 });
    
    // Navigate and wait for content to load
    // Fathom loads the player/transcript dynamically
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for the transcript container or video player to appear
    try {
        await page.waitForSelector('[data-testid="transcript-container"], video', { timeout: 15000 });
    } catch (e) {
        console.warn("Timed out waiting for transcript or video selector. Continuing with current DOM state.");
    }

    // Extract page content
    const content = await page.content();
    const dom = new JSDOM(content);
    const document = dom.window.document;

    // Metadata
    const title = document.querySelector('h1')?.textContent?.trim() || 
                  document.title.replace(' | Fathom', '').trim() || 
                  'Fathom Recording';
    
    const date = document.querySelector('time')?.getAttribute('datetime') || 
                 new Date().toISOString();

    // Transcript
    // Fathom transcripts are usually organized in blocks with speaker names
    // Strategy: Look for the transcript container and iterate over blocks
    const transcriptBlocks = [];
    const transcriptContainer = document.querySelector('[data-testid="transcript-container"]') || 
                                document.querySelector('.transcript-content'); // Fallback class
    
    if (transcriptContainer) {
      // Logic for structured transcript extraction would go here
      // For now, grabbing all text content as a raw fallback if structure fails
      // This part needs refinement based on Fathom's specific changing DOM structure
      const textNodes = Array.from(transcriptContainer.querySelectorAll('p, div[role="listitem"]'));
      textNodes.forEach(node => {
          const text = node.textContent.trim();
          if (text) transcriptBlocks.push(text);
      });
    } else {
        // Fallback: simpler text extraction if specific container not found
        console.warn("Structured transcript container not found.");
    }

    const transcript = transcriptBlocks.join('\n\n');

    // Video URL
    // Look for the <video> src or source tags
    let videoUrl = null;
    const videoEl = document.querySelector('video');
    if (videoEl) {
        videoUrl = videoEl.src || videoEl.querySelector('source')?.src;
    }

    return {
      title,
      date,
      transcript,
      videoUrl,
      sourceUrl: url
    };

  } catch (error) {
    console.error('Error extracting Fathom data:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// CLI usage if run directly
if (process.argv[1] === import.meta.url) {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node src/extractor.js <fathom_url>');
    process.exit(1);
  }
  
  extractFathomData(url)
    .then(data => console.log(JSON.stringify(data, null, 2)))
    .catch(err => process.exit(1));
}
