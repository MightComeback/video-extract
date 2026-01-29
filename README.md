# fathom2action (fathom-extract)

Turn a Fathom share link into an **actionable bug report brief** (`fathom2action`), and optionally extract the **transcript + video** (`fathom-extract`).

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

### 0) Fathom link → actionable bug brief (MVP)

```bash
fathom2action "https://fathom.video/share/<TOKEN>"

# (optional) copy the brief directly to your clipboard
fathom2action "https://fathom.video/share/<TOKEN>" --copy

# see all flags
fathom2action --help

# print version
fathom2action --version
```

If the link is auth-gated (401/403) or otherwise not fetchable, paste transcript/notes:

```bash
pbpaste | fathom2action --stdin
```

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
- `extracted.json` (includes `mediaSegmentsDir` + `mediaSegments`)
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

Optional:
- `FATHOM_USER_AGENT=...` (override the default `fathom-extract/<version>` user-agent)

`--cookie-file` supports:
- Netscape cookies.txt
- one-per-line `name=value`
- JSON exports: `[{"name":"...","value":"..."}, ...]`

#### Getting a cookie for auth-gated share links

If the share link returns **401/403**, you likely need to pass your logged-in session cookies.

Quick way (Chrome):
1. Open the share link while logged into Fathom.
2. DevTools → **Network** → click the document request for the share page.
3. In **Request Headers**, copy the full `cookie:` header value.
4. Save it to a file (any of these formats work):

```bash
# option A: a raw Cookie header (works as-is)
echo "Cookie: <paste here>" > cookie.txt

# option B: just the cookie pairs
echo "<name=value; other=value>" > cookie.txt
```

Then run:

```bash
fathom-extract "https://fathom.video/share/<TOKEN>" --cookie-file ./cookie.txt --out-dir ./artifacts --pretty
```

## What this repo does
- Extract transcript text (best-effort)
- Resolve media URLs
- Download media to `video.mp4`
- Split into N-second chunks (default 300s)

## What this repo does NOT do
- No LLM processing

## CLI flags (extractor)
- `--out-dir <dir>`: write `transcript.txt` + `extracted.json` + media artifacts
- `--cookie <cookie>` / `--cookie-file <path>`
- `--referer <url>`: set an explicit `Referer` header (some auth flows/CDNs require this)
- `--split-seconds <n>` / `FATHOM_SPLIT_SECONDS=<n>`
- `--no-download` (skip video download)
- `--no-split` (download video but don’t split)
- `--download-media <path>` (set mp4 output path)
- `--pretty` (pretty JSON)
