# fathom-extract

Extract **transcript + video** from a Fathom link.

## Install

### Option A: run from the repo (recommended)

```bash
git clone git@github.com:MightComeback/fathom-extract.git
cd fathom-extract

# verify dependencies
node -v
ffmpeg -version

# optional: make `fathom-extract` available globally
npm link
```

### Option B: no global install (explicit path)

```bash
node ./bin/fathom2action-extract.js --help
```

## Requirements
- Node.js
- `ffmpeg` (for video download + splitting)

## Usage (copy/paste)

### 1) Auth-gated Fathom link → transcript + video.mp4 + 5-min segments

```bash
fathom-extract "https://fathom.video/share/<TOKEN>" \
  --cookie-file ./cookie.txt \
  --out-dir ./artifacts \
  --split-seconds 300 \
  --pretty
```

Outputs in `./artifacts/`:
- `transcript.txt`
- `extracted.json`
- `video.mp4`
- `segments/segment_000.mp4`, `segment_001.mp4`, ...

### 2) Transcript-only (skip video download)

```bash
fathom-extract "https://fathom.video/share/<TOKEN>" --cookie-file ./cookie.txt --no-download --pretty
```

### 3) Control segment size

```bash
# default split size when --split-seconds isn't provided
export FATHOM_SPLIT_SECONDS=300

fathom-extract "https://..." --cookie-file ./cookie.txt --out-dir ./artifacts --pretty
```

### 4) Cookie options

Any of these work:
- `--cookie "name=value; other=value"`
- `--cookie-file ./cookie.txt`
- `FATHOM_COOKIE=...`
- `FATHOM_COOKIE_FILE=...`

`--cookie-file` supports:
- Netscape cookies.txt
- one-per-line `name=value`
- JSON exports: `[{"name":"...","value":"..."}, ...]`

## What this repo does
- Extract transcript text (best-effort)
- Resolve media URLs
- Download media to `video.mp4`
- Split into N-second chunks (default 300s)

## What this repo does NOT do
- No LLM processing
- No bug-brief generation

## CLI flags (extractor)
- `--out-dir <dir>`: write `transcript.txt` + `extracted.json` + media artifacts
- `--cookie <cookie>` / `--cookie-file <path>`
- `--split-seconds <n>` / `FATHOM_SPLIT_SECONDS=<n>`
- `--no-download` (skip video download)
- `--no-split` (download video but don’t split)
- `--download-media <path>` (set mp4 output path)
- `--pretty` (pretty JSON)
