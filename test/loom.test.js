import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  isLoomUrl,
  isLoomDomain,
  parseLoomTranscript,
  normalizeLoomUrl,
  loomNonVideoReason,
  extractLoomMetadataFromHtml,
  fetchLoomOembed,
  extractLoomTranscriptUrl,
  extractLoomId,
} from '../src/providers/loom.js';

test('isLoomUrl matches valid URLs', () => {
  assert.ok(isLoomUrl('https://www.loom.com/share/abc12345'), 'Should match share URL');
  assert.ok(isLoomUrl('https://loom.com/v/xyz98765'), 'Should match /v/ URL');
  assert.equal(isLoomUrl('https://google.com'), false, 'Should not match Google');
});

test('isLoomDomain matches Loom domains', () => {
  assert.ok(isLoomDomain('https://loom.com/share/abc'), 'Should match loom.com');
  assert.ok(isLoomDomain('https://www.loom.com/share/abc'), 'Should match www.loom.com');
  assert.ok(isLoomDomain('https://share.loom.com/share/abc'), 'Should match share.loom.com');
  assert.ok(isLoomDomain('https://useloom.com/share/abc'), 'Should match useloom.com (legacy)');
  assert.equal(isLoomDomain('https://google.com'), false, 'Should not match Google');
});

test('extractLoomId extracts IDs from various URL shapes', () => {
  assert.equal(extractLoomId('https://loom.com/share/abc12345'), 'abc12345');
  assert.equal(extractLoomId('https://loom.com/v/xyz98765'), 'xyz98765');
  assert.equal(extractLoomId('https://loom.com/embed/abc123'), 'abc123');
  assert.equal(extractLoomId('https://loom.com/recording/abc123'), 'abc123');
  assert.equal(extractLoomId('https://loom.com/i/abc123'), 'abc123');
  assert.equal(extractLoomId('https://loom.com/s/abc123'), 'abc123');
  // Bare ID pattern: https://loom.com/<id>
  assert.equal(extractLoomId('https://loom.com/1234567890abcdef'), '1234567890abcdef');
  assert.equal(extractLoomId('https://google.com'), null, 'Should not extract from non-Loom');
});

test('normalizeLoomUrl canonicalizes various Loom URL shapes', () => {
  // Basic share URLs
  assert.equal(normalizeLoomUrl('https://www.loom.com/share/abc123'), 'https://loom.com/share/abc123');
  assert.equal(normalizeLoomUrl('https://loom.com/v/abc123'), 'https://loom.com/share/abc123');
  assert.equal(normalizeLoomUrl('https://loom.com/embed/abc123'), 'https://loom.com/share/abc123');
  assert.equal(normalizeLoomUrl('https://loom.com/recording/abc123'), 'https://loom.com/share/abc123');

  // Preserve session ID for private shares
  assert.equal(
    normalizeLoomUrl('https://loom.com/share/abc123?sid=xyz789&utm_source=share'),
    'https://loom.com/share/abc123?sid=xyz789'
  );

  // Preserve timestamps
  assert.equal(
    normalizeLoomUrl('https://loom.com/share/abc123?t=62'),
    'https://loom.com/share/abc123?t=62'
  );
  assert.equal(
    normalizeLoomUrl('https://loom.com/share/abc123#t=62'),
    'https://loom.com/share/abc123?t=62'
  );

  // Legacy useloom.com
  assert.equal(normalizeLoomUrl('https://share.useloom.com/share/abc123'), 'https://loom.com/share/abc123');

  // Non-Loom URLs pass through (URL parsing may add trailing slash)
  const nonLoom = normalizeLoomUrl('https://google.com');
  assert.ok(nonLoom === 'https://google.com' || nonLoom === 'https://google.com/');
});

test('loomNonVideoReason detects non-video Loom URLs', () => {
  assert.equal(
    loomNonVideoReason('https://loom.com/pricing'),
    'This Loom URL does not appear to be a direct video link. Please provide a Loom share URL like https://loom.com/share/<id> instead.'
  );
  assert.equal(
    loomNonVideoReason('https://loom.com/login'),
    'This Loom URL does not appear to be a direct video link. Please provide a Loom share URL like https://loom.com/share/<id> instead.'
  );
  assert.equal(
    loomNonVideoReason('https://loom.com/signup'),
    'This Loom URL does not appear to be a direct video link. Please provide a Loom share URL like https://loom.com/share/<id> instead.'
  );
  assert.equal(loomNonVideoReason('https://loom.com/share/abc123'), '', 'Video URLs should return empty');
  assert.equal(loomNonVideoReason('https://google.com'), '', 'Non-Loom should return empty');
});

test('extractLoomMetadataFromHtml extracts metadata from Apollo state', () => {
  const mockApolloState = {
    'RegularUserVideo:abc123': {
      id: 'abc123',
      name: 'Test Video Title',
      description: 'Test description',
      createdAt: '2024-01-15T10:00:00Z',
      duration: 120,
      nullableRawCdnUrlMP4: { url: 'https://cdn.loom.com/video.mp4' },
      posterUrl: 'https://cdn.loom.com/poster.jpg',
      owner: { __ref: 'User:user123' },
      transcript: { __ref: 'Transcript:trans123' },
    },
    'User:user123': {
      firstName: 'John',
      lastName: 'Doe',
    },
    'Transcript:trans123': {
      paragraphs: [
        { __ref: 'Paragraph:p1' },
        { __ref: 'Paragraph:p2' },
      ],
    },
    'Paragraph:p1': { text: 'Hello world', startTime: 5 },
    'Paragraph:p2': { text: 'Second line', startTime: 15 },
    'VideoTranscriptDetails:vtd123': {
      video: { __ref: 'RegularUserVideo:abc123' },
      captions_source_url: 'https://cdn.loom.com/transcript.vtt',
    },
  };

  const html = `
    <html>
      <script>
        window.__APOLLO_STATE__ = ${JSON.stringify(mockApolloState)};
      </script>
    </html>
  `;

  const meta = extractLoomMetadataFromHtml(html);
  assert.equal(meta.title, 'Test Video Title');
  assert.equal(meta.description, 'Test description');
  assert.equal(meta.date, '2024-01-15T10:00:00Z');
  assert.equal(meta.duration, 120);
  assert.equal(meta.mediaUrl, 'https://cdn.loom.com/video.mp4');
  assert.equal(meta.thumbnailUrl, 'https://cdn.loom.com/poster.jpg');
  assert.equal(meta.author, 'John Doe');
  assert.equal(meta.transcriptUrl, 'https://cdn.loom.com/transcript.vtt');
  assert.ok(meta.transcriptText.includes('0:05 Hello world'));
  assert.ok(meta.transcriptText.includes('0:15 Second line'));
});

test('extractLoomMetadataFromHtml falls back to LD+JSON', () => {
  const html = `
    <html>
      <script type="application/ld+json">
        {
          "@type": "VideoObject",
          "name": "Fallback Title",
          "description": "Fallback description",
          "uploadDate": "2024-01-15",
          "thumbnailUrl": "https://cdn.loom.com/thumb.jpg",
          "author": { "name": "Jane Doe" }
        }
      </script>
    </html>
  `;

  const meta = extractLoomMetadataFromHtml(html);
  assert.equal(meta.title, 'Fallback Title');
  assert.equal(meta.description, 'Fallback description');
  assert.equal(meta.date, '2024-01-15');
  assert.equal(meta.thumbnailUrl, 'https://cdn.loom.com/thumb.jpg');
  assert.equal(meta.author, 'Jane Doe');
});

test('extractLoomTranscriptUrl extracts transcript URL from HTML', () => {
  const mockApolloState = {
    'VideoTranscriptDetails:vtd123': {
      captions_source_url: 'https://cdn.loom.com/captions.vtt',
      source_url: 'https://cdn.loom.com/source.json',
    },
  };

  const html = `
    <html>
      <script>
        window.__APOLLO_STATE__ = ${JSON.stringify(mockApolloState)};
      </script>
    </html>
  `;

  const url = extractLoomTranscriptUrl(html);
  assert.equal(url, 'https://cdn.loom.com/captions.vtt');
});

test('extractLoomTranscriptUrl prefers VTT over JSON', () => {
  const mockApolloState = {
    'VideoTranscriptDetails:vtd123': {
      captions_source_url: 'https://cdn.loom.com/captions.vtt',
      source_url: 'https://cdn.loom.com/source.json',
    },
  };

  const html = `
    <html>
      <script>
        window.__APOLLO_STATE__ = ${JSON.stringify(mockApolloState)};
      </script>
    </html>
  `;

  const url = extractLoomTranscriptUrl(html);
  // Should prefer VTT format
  assert.ok(url?.endsWith('.vtt'));
});

test('parseLoomTranscript handles JSON paragraphs', () => {
  const input = JSON.stringify({
    paragraphs: [
      { text: "Hello world", startTime: 5 },
      { text: "Second line", startTime: 65 }
    ]
  });
  const output = parseLoomTranscript(input);

  // 5s -> 0:05, 65s -> 1:05
  assert.match(output, /0:05 Hello world/);
  assert.match(output, /1:05 Second line/);
});

test('parseLoomTranscript handles WebVTT format', () => {
  const vtt = `WEBVTT

00:00:05.000 --> 00:00:10.000
Hello from VTT

00:01:05.000 --> 00:01:10.000
Second line from VTT
`;

  const output = parseLoomTranscript(vtt);
  // parseSimpleVtt extracts plain text without timestamps
  assert.match(output, /Hello from VTT/);
  assert.match(output, /Second line from VTT/);
});

test('parseLoomTranscript handles segments format', () => {
  const input = JSON.stringify({
    segments: [
      { text: "Segment one", start: 10 },
      { text: "Segment two", start: 70 }
    ]
  });
  const output = parseLoomTranscript(input);
  assert.match(output, /0:10 Segment one/);
  assert.match(output, /1:10 Segment two/);
});

test('fetchLoomOembed fetches oEmbed data', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async (url) => {
      if (url.includes('loom.com/v1/oembed')) {
        return {
          ok: true,
          json: async () => ({
            title: 'Test Loom Video',
            author_name: 'Test Author',
            thumbnail_url: 'https://cdn.loom.com/thumb.jpg',
          }),
        };
      }
      throw new Error('Unexpected URL: ' + url);
    };

    const result = await fetchLoomOembed('https://loom.com/share/abc123');
    assert.equal(result.title, 'Test Loom Video');
    assert.equal(result.author_name, 'Test Author');
    assert.equal(result.thumbnail_url, 'https://cdn.loom.com/thumb.jpg');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchLoomOembed returns null on error', async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => {
      throw new Error('Network error');
    };

    const result = await fetchLoomOembed('https://loom.com/share/abc123');
    assert.equal(result, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
