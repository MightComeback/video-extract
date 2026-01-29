# fathom2action (fathom-extract)

Turn a Fathom share link into an **actionable bug report brief** (`fathom2action`), and optionally extract the **transcript + video** (`fathom-extract`).

## Install

### Option A: run from the repo (recommended)

```bash
git clone git@github.com:MightComeback/fathom-extract.git
cd fathom-extract

# install deps (this repo is dependency-light, but npm link expects a package install)
npm install

# verify dependencies
node -v
ffmpeg -version

# optional: make `fathom-extract` + `fathom2action` available globally
npm link
```

### Option B: no global install (explicit path)

```bash
# brief generator
node ./bin/fathom2action-brief.js --help

# extractor
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

# output JSON ({source,title,brief})
fathom2action "https://fathom.video/share/<TOKEN>" --json

# copy *only* the rendered brief (useful with --json)
fathom2action "https://fathom.video/share/<TOKEN>" --json --copy-brief

# print version
fathom2action --version

# hide timestamps/teaser sections (useful when you want a very compact brief)
fathom2action "https://fathom.video/share/<TOKEN>" --max-timestamps 0 --max-teaser 0
```

If the link is auth-gated (401/403) or otherwise not fetchable, paste transcript/notes:

```bash
pbpaste | fathom2action --stdin

# Windows PowerShell
Get-Clipboard | fathom2action --stdin
```

You can also paste a small “envelope” for better output (copy/paste friendly):

```text
Source: https://fathom.video/share/<TOKEN>
Title: Login breaks on Safari

00:01 Alice: It crashes when I click “Sign in”…
```

Or (same thing) without prefixes:

```text
https://fathom.video/share/<TOKEN>
# Login breaks on Safari

00:01 Alice: It crashes when I click “Sign in”…
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

## CLI flags (brief generator: `fathom2action`)
- `--stdin` / `-`: read transcript/notes from stdin (use this when the share link is auth-gated)
- `--template`: generate a blank brief template (no URL fetch / no stdin required)
- `--copy`: copy the output to clipboard (best-effort; tries `pbcopy`, `clip.exe`/`clip`, `wl-copy`, `xclip`, or `xsel`)
- `--copy-brief`: copy the markdown brief to clipboard (even if `--json` is used)
- `--out <path>`: also write the output to a file (`--out -` means “stdout”)
- `--json`: output `{ source, title, brief }` as JSON instead of markdown
- `--source <url>`: override the `Source` field (handy with `--stdin` or `--template`)
- `--title <text>`: override the `Title` field (handy with `--stdin` or `--template`)
- `--cmd <name>`: override the command name shown in the brief (useful for `npx` / `bunx`)
- `--version` / `-v`: print version and exit
- `--no-note`: suppress the helpful stderr hint printed when a link can’t be fetched
- `--max-teaser <n>`: max number of transcript teaser bullets to render (default: 6; use 0 to hide)
- `--max-timestamps <n>`: max number of timestamps to render (default: 6; use 0 to hide)

Env defaults (flags win):
- `F2A_MAX_TEASER=<n>`
- `F2A_MAX_TIMESTAMPS=<n>`
- `F2A_COPY=1` (behave as if `--copy` was passed)
- `F2A_COPY_BRIEF=1` (behave as if `--copy-brief` was passed)
- `F2A_OUT=<path>` (behave as if `--out <path>` was passed)
- `F2A_SOURCE=<url>` (behave as if `--source <url>` was passed)
- `F2A_TITLE=<text>` (behave as if `--title <text>` was passed)
- `F2A_CMD=<name>` (behave as if `--cmd <name>` was passed)
- `F2A_NO_NOTE=1` (behave as if `--no-note` was passed)

## CLI flags (extractor: `fathom-extract`)
- `--out-dir <dir>`: write `transcript.txt` + `extracted.json` + media artifacts
- `--cookie <cookie>` / `--cookie-file <path>`
- `--referer <url>` / `FATHOM_REFERER=...`: set an explicit `Referer` header (some auth flows/CDNs require this)
- `--user-agent <ua>` / `FATHOM_USER_AGENT=...`: override the `User-Agent` header used for fetch + media download
- `--split-seconds <n>` / `FATHOM_SPLIT_SECONDS=<n>`
- `--no-download` (skip video download)
- `--no-split` (download video but don’t split)
- `--download-media <path>` (set mp4 output path)
- `--pretty` (pretty JSON)

<!-- Tracking: MIG-14 -->

## Run locally

```bash
# install
npm install

# verify
npm test
npm run lint
```

## Migration (MIG-14)

- [ ] Keep extractor output stable across inputs (golden tests)
- [ ] Document required env vars and examples

### Env vars (helpers)

- `LINEAR_API_KEY`: required to use `scripts/linear.js` (used by the always-on shipping loop)

## MIG-14

Tracking: Linear issue MIG-14.
