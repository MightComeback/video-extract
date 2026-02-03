import { test } from 'node:test';
import assert from 'node:assert';
import { parseSimpleVtt } from '../src/utils.js';

test('parseSimpleVtt extracts text from basic VTT', (t) => {
  const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello world

00:00:04.000 --> 00:00:08.000
This is a test.
`;
  const text = parseSimpleVtt(vtt);
  assert.equal(text, 'Hello world This is a test.');
});

test('parseSimpleVtt handles cues with identifiers', (t) => {
  const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello

2
00:00:04.000 --> 00:00:08.000
World
`;
  const text = parseSimpleVtt(vtt);
  assert.equal(text, 'Hello World');
});

test('parseSimpleVtt ignores NOTE/STYLE blocks', (t) => {
  const vtt = `WEBVTT
X-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:0

NOTE
This is a note that should be ignored.
Even across multiple lines.

STYLE
::cue { color: lime; }

00:00.000 --> 00:01.000
Hello

00:01.000 --> 00:02.000
World
`;
  const text = parseSimpleVtt(vtt);
  assert.equal(text, 'Hello World');
});

test('parseSimpleVtt strips common WebVTT markup + decodes basic entities', (t) => {
  const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
<c.colorE5E5E5>Hello &amp; welcome</c>

00:00:04.000 --> 00:00:08.000
<v Speaker>Look &lt;here&gt; &nbsp; now</v>
`;

  const text = parseSimpleVtt(vtt);
  assert.equal(text, 'Hello & welcome Look <here> now');
});

test('parseSimpleVtt decodes common apostrophe entities', (t) => {
  const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Don&apos;t stop

00:00:04.000 --> 00:00:08.000
Rock &#x27;n&#39; roll
`;

  const text = parseSimpleVtt(vtt);
  assert.equal(text, "Don't stop Rock 'n' roll");
});

test('parseSimpleVtt returns empty string for empty input', (t) => {
  assert.equal(parseSimpleVtt(''), '');
  assert.equal(parseSimpleVtt(null), '');
});
