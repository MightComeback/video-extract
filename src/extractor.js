import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function readStdin() {
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

function decodeHtmlEntities(s) {
  return String(s)
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function extractMetaContent(html, { name, property }) {
  const s = String(html);
  const metas = s.match(/<meta\s+[^>]*>/gi) || [];

  for (const tag of metas) {
    const attrs = {};

    // Best-effort attribute parse: key="value" and key='value'
    for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([\s\S]*?)"|'([\s\S]*?)')/g)) {
      const key = (m[1] || '').toLowerCase();
      const val = m[3] ?? m[4] ?? '';
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

function extractTitleFromHtml(html) {
  const s = String(html);
  const t = s.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) {
    const raw = decodeHtmlEntities(t[1] || '').trim();
    return raw.replace(/\s+/g, ' ').trim();
  }

  // Fallbacks commonly present on share pages.
  return (
    extractMetaContent(s, { property: 'og:title' }) ||
    extractMetaContent(s, { name: 'twitter:title' }) ||
    ''
  );
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

export function normalizeFetchedContent(content) {
  const s = String(content || '').trim();
  if (!s) return { text: '', suggestedTitle: '' };
  const looksHtml = /<\s*html[\s>]/i.test(s) || /<\s*title[\s>]/i.test(s);
  if (!looksHtml) return { text: s, suggestedTitle: '' };
  return { text: stripHtmlToText(s), suggestedTitle: extractTitleFromHtml(s) };
}

export async function fetchUrlText(url) {
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

export async function extractFromUrl(url) {
  const fetched = await fetchUrlText(url);
  if (fetched.ok) {
    const norm = normalizeFetchedContent(fetched.text);
    return {
      ok: true,
      source: url,
      text: norm.text,
      suggestedTitle: norm.suggestedTitle,
      fetchError: null
    };
  }

  return {
    ok: false,
    source: url,
    text: 'Unable to fetch this link (likely auth/cookies). Paste transcript/notes here, or run: fathom2action --stdin',
    suggestedTitle: '',
    fetchError: fetched.error
  };
}

export function extractFromStdin({ content, source }) {
  const text = String(content || '').trim();
  if (!text) {
    const err = new Error('stdin is empty');
    err.code = 2;
    throw err;
  }
  return { ok: true, source: source || 'stdin', text, suggestedTitle: '', fetchError: null };
}
