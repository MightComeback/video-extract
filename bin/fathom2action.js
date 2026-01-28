#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
}

function getVersion() {
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

function usage(code = 0) {
  console.log(`fathom2action\n\nUsage:\n  fathom2action <fathom-url>\n  fathom2action --stdin\n  fathom2action -          # read stdin\n  fathom2action --version\n\nTip:\n  If you run without args and stdin is piped, it will automatically read stdin.\n\nOutput:\n  Prints a markdown bug brief template filled with extracted context (best effort).\n\nNotes:\n  MVP intentionally works even without API keys: if we can't fetch/parse the link, pipe transcript/notes via --stdin.\n`);
  process.exit(code);
}

function decodeHtmlEntities(s) {
  return String(s)
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function extractTitleFromHtml(html) {
  const m = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  const raw = decodeHtmlEntities(m[1] || '').trim();
  return raw.replace(/\s+/g, ' ').trim();
}

function stripHtmlToText(html) {
  let s = String(html);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  // Preserve some structure as newlines before stripping tags.
  s = s.replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeHtmlEntities(s);
  s = s.replace(/\r/g, '');
  s = s.replace(/\n\s*\n\s*\n+/g, '\n\n');
  s = s.replace(/[\t\f\v ]+/g, ' ');
  return s.trim();
}

function normalizeFetchedContent(content) {
  const s = String(content || '').trim();
  if (!s) return { text: '', suggestedTitle: '' };
  const looksHtml = /<\s*html[\s>]/i.test(s) || /<\s*title[\s>]/i.test(s);
  if (!looksHtml) return { text: s, suggestedTitle: '' };
  return { text: stripHtmlToText(s), suggestedTitle: extractTitleFromHtml(s) };
}

function mkBrief({ source, content, fetchError, suggestedTitle }) {
  const text = (content || '').trim();
  const lines = [];
  lines.push(`# Bug brief`);
  lines.push('');
  if (source) lines.push(`Source: ${source}`);
  if (fetchError) lines.push(`Fetch: failed (${fetchError}) — paste transcript/notes via \`fathom2action --stdin\``);
  lines.push('');
  lines.push('## Suggested issue title (optional)');
  lines.push('');
  lines.push(`- ${suggestedTitle ? suggestedTitle : ''}`);
  lines.push('');
  lines.push('## Summary (1 sentence)');
  lines.push('');
  lines.push('- ');
  lines.push('');
  lines.push('## Repro steps');
  lines.push('');
  lines.push('1. ');
  lines.push('');
  lines.push('## Expected vs actual');
  lines.push('');
  lines.push('- Expected: ');
  lines.push('- Actual: ');
  lines.push('');
  lines.push('## Context / environment');
  lines.push('');
  lines.push('- Where (env/feature flag/build): ');
  lines.push('- Who saw it: ');
  lines.push('- When: ');
  lines.push('');
  lines.push('## Timestamps (if mentioned)');
  lines.push('');
  lines.push('- ');
  lines.push('');
  lines.push('## Notes / raw extract');
  lines.push('');
  lines.push('```');
  lines.push(text.slice(0, 4000));
  if (text.length > 4000) lines.push('\n…(truncated)…');
  lines.push('```');
  lines.push('');
  lines.push('## Next actions');
  lines.push('');
  lines.push('- [ ] Create Linear/GitHub issue');
  lines.push('- [ ] Assign owner');
  lines.push('- [ ] Add severity + scope');
  return lines.join('\n');
}

async function fetchUrlText(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'fathom2action/0.1 (+https://github.com/MightComeback/fathom2action)'
      }
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
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

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) usage(0);
  if (args.includes('-v') || args.includes('--version')) {
    console.log(getVersion());
    return;
  }

  // Convenience: if no args and stdin is piped, treat it like --stdin.
  if (!args.length) {
    if (!process.stdin.isTTY) {
      const content = await readStdin();
      if (!content.trim()) {
        console.error('ERR: stdin is empty');
        process.exit(2);
      }
      console.log(mkBrief({ source: 'stdin', content }));
      return;
    }
    usage(0);
  }

  if (args[0] === '--stdin' || args[0] === '-') {
    const content = await readStdin();
    if (!content.trim()) {
      console.error('ERR: stdin is empty');
      process.exit(2);
    }
    console.log(mkBrief({ source: 'stdin', content }));
    return;
  }

  const url = args[0];

  // Best-effort fetch: public links may work; private/authenticated ones won't.
  const fetched = await fetchUrlText(url);
  if (fetched.ok) {
    const norm = normalizeFetchedContent(fetched.text);
    console.log(mkBrief({ source: url, content: norm.text, suggestedTitle: norm.suggestedTitle }));
    return;
  }

  console.log(
    mkBrief({
      source: url,
      fetchError: fetched.error,
      content: 'Unable to fetch this link (likely auth/cookies). Paste transcript/notes here, or run: fathom2action --stdin'
    })
  );
}

main().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
