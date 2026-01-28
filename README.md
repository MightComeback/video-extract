# fathom2action

Turn a Fathom recording/link into an **engineering-actionable bug brief** (so you don’t watch the whole video).

## Install

```bash
npm i -g fathom2action
```

## Usage

Preferred workflow (micro-tools):

```bash
# URL → JSON artifacts → markdown bug brief
fathom-extract "https://..." --pretty | fathom-transform --json > bug.md

# Or: paste transcript/notes → markdown bug brief
pbpaste | fathom-transform --stdin --source "notes" > bug.md
```

Shortcut/legacy wrapper:

```bash
# One-step wrapper (kept for backward compatibility)
fathom2action "https://..."

# Wrapper from stdin
pbpaste | fathom2action --stdin > bug.md
```

## Micro-tools (separation of concerns)

This repo intentionally keeps **extraction** and **actionization** separate.

### 1) Extract (URL/stdin → JSON artifacts)

Preferred name: `fathom-extract` (aliases kept for backward-compat).

```bash
# URL → JSON artifacts (transcript + mediaUrl)
# If mediaUrl is present, it will also download a local mp4 and split into 5-min segments by default.
fathom-extract "https://..." --out-dir ./artifacts --pretty

# Auth-gated links (Fathom cookies required)
fathom-extract "https://..." --cookie-file ./cookie.txt --out-dir ./artifacts --pretty

# Transcript-only mode (skip media download)
fathom-extract "https://..." --no-download --pretty

# stdin → JSON (useful when the link is private/auth-gated)
pbpaste | fathom-extract --stdin --source "https://..." --pretty
```

#### Auth-gated links (real Fathom recordings): cookies + ffmpeg

Many real Fathom share links require auth. The extractor supports passing cookies so it can fetch the transcript page and download the underlying media.

Requirements:
- `ffmpeg` on your PATH (used to download + split the video)
- a valid Fathom session cookie

Cookie options (any of these work):
- `--cookie "name=value; other=value"`
- `--cookie-file ./cookie.txt` (supports Netscape cookies.txt, one-per-line `name=value`, and JSON exports)
- env vars: `FATHOM_COOKIE` or `FATHOM_COOKIE_FILE`

```bash
# Typical: cookie file → transcript + video.mp4 + 5-min segments
fathom-extract "https://..." --cookie-file ./cookie.txt --out-dir ./artifacts --pretty

# Equivalent via env var
export FATHOM_COOKIE_FILE=./cookie.txt
fathom-extract "https://..." --out-dir ./artifacts --pretty
```

#### Gemini ingestion: split video into ~5-minute chunks

When media is downloadable, the extractor writes:
- `video.mp4`
- `segments/segment_000.mp4`, `segments/segment_001.mp4`, …

```bash
# Explicit chunking (default is 300 seconds)
fathom-extract "https://..." --out-dir ./artifacts --split-seconds 300 --pretty

# Save the mp4 at a specific path
fathom-extract "https://..." --download-media ./artifacts/video.mp4 --pretty
```

### 2) Transform (JSON/raw text → markdown bug brief)

Preferred name: `fathom-transform` (aliases kept for backward-compat).

```bash
# Pipe extractor JSON → transformer markdown
fathom-extract "https://..." | fathom-transform --json > bug.md

# Or transform raw transcript/notes directly
pbpaste | fathom-transform --stdin --source "meeting notes" > bug.md
```

## Output
Produces markdown with:
- 1-sentence summary
- repro steps
- expected vs actual
- context/environment
- timestamps
- next actions

## Example

```bash
# Notes/transcript → bug brief
pbpaste | fathom-transform --stdin --source "meeting notes" > bug.md

# Or: URL → artifacts → bug brief
fathom-extract "https://..." | fathom-transform --json > bug.md
```

Example output (truncated):

```md
# Bug brief

Source: stdin

## Suggested issue title (optional)

- 

## Summary (1 sentence)

- 

## Repro steps

1. 

## Expected vs actual

- Expected: 
- Actual: 

## Next actions

- [ ] Create Linear/GitHub issue
- [ ] Assign owner
- [ ] Add severity + scope
```

## Roadmap
- Validate extractor against real, auth-gated Fathom links (cookie flow) and document a known-good setup
- Optional AI fill-in (OpenAI/other) to generate summary + repro steps
- One-command: create Linear/GitHub issue
