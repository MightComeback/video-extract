# video-extract

Turn a Fathom, Loom, YouTube, or Vimeo link into an **actionable bug report brief** (`video-brief`), and optionally extract the **transcript + video** (`video-extract` / `vdxtr`).

## Install

### Option A: run from the repo (recommended)

```bash
git clone https://github.com/MightComeback/video-extract.git
cd video-extract

# install deps
bun install

# verify dependencies
bun -v
node -v
ffmpeg -version

# optional: make CLIs available globally
bun link
```

### Option B: no global install (explicit path)

```bash
# brief generator
bun ./bin/video-brief.js --help

# extractor
bun ./bin/video-extract.js --help

# (on macOS/Linux you can also run them directly after cloning)
# chmod +x ./bin/*.js
# ./bin/video-brief.js --help
```

## Requirements
- Node.js
- `ffmpeg` (for video download + splitting)

## Usage (copy/paste)

### 0) Generate brief from URL (Fathom / Loom / YouTube / Vimeo)

```bash
# Fathom
video-brief "https://fathom.video/share/<TOKEN>"

# Loom
video-brief "https://www.loom.com/share/..."

# YouTube
video-brief "https://www.youtube.com/watch?v=..."

# Vimeo
video-brief "https://vimeo.com/..."


# (optional) copy the brief directly to your clipboard
video-brief "https://fathom.video/share/<TOKEN>" --copy

# see all flags
video-brief --help

# output JSON ({source,title,brief})
video-brief "https://fathom.video/share/<TOKEN>" --json

# copy *only* the rendered brief (useful with --json)
video-brief "https://fathom.video/share/<TOKEN>" --json --copy-brief

# print version
video-brief --version

# hide timestamps/teaser sections (useful when you want a very compact brief)
video-brief "https://fathom.video/share/<TOKEN>" --max-timestamps 0 --max-teaser 0
```

### 1) Extract transcript + media (video-extract / vdxtr)

```bash
# extract metadata + transcript (JSON)
video-extract "https://fathom.video/share/<TOKEN>" --pretty

# download video (requires ffmpeg)
video-extract "https://www.youtube.com/watch?v=..." --out-dir ./artifacts --download

# short alias
vdxtr "https://vimeo.com/..." --out-dir ./artifacts --download

# see all flags
video-extract --help
```

### Compatibility (legacy commands)

These are kept for older scripts, but new usage should prefer `video-brief` / `video-extract` / `vdxtr`.

```bash
fathom2action "https://fathom.video/share/<TOKEN>"
fathom-extract "https://fathom.video/share/<TOKEN>" --out-dir ./artifacts --pretty
```

If the link is auth-gated (401/403) or otherwise not fetchable, paste transcript/notes:

```bash
pbpaste | video-brief --stdin

# Windows PowerShell
Get-Clipboard | video-brief --stdin
```

If you just want a blank brief to fill in manually (no URL fetch / no stdin):

```bash
video-brief --template --copy

# optionally pre-fill Source/Title
video-brief --template --source "https://fathom.video/share/<TOKEN>" --title "Login breaks on Safari" --copy
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

### Example Output

By default, `video-brief` produces a markdown brief ready to paste into Linear or GitHub:

```markdown
# Bug report brief

Source: https://fathom.video/share/...
Title: Login breaks on Safari

## Links
- Fathom: https://fathom.video/share/...

## How to update this brief
- If you can access the Fathom link: re-run \`video-brief "<link>"\`
- If the link is auth-gated: copy the transcript and pipe it into \`video-brief --stdin\`
...

## 1-sentence summary
- 

## Repro steps
1. 
2. 
3. 

## Expected vs actual
- Expected: 
- Actual: 

## Environment / context
- Who: 
- Where (page/URL): 
- Browser / OS: 
- Build / SHA: 
- When: 

## Attachments / evidence
- Screenshot(s): 
- Console/logs: 
- Video: 

## Timestamps
- 

## Next actions
- [ ] 

## Transcript teaser (first lines)
- 00:01 Alice: It crashes when I click “Sign in”…
```

### 1) Auth-gated Fathom link → transcript + video.mp4 + 5-min segments

(Shorthand: `vdxtr` is an alias for `video-extract`.)

```bash
vdxtr "https://fathom.video/share/<TOKEN>" \
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
vdxtr "https://fathom.video/share/<TOKEN>" --cookie-file ./cookie.txt --no-download --pretty
```

### 3) Control segment size

```bash
# default split size when --split-seconds isn't provided
export VIDEO_EXTRACT_SPLIT_SECONDS=300
# compat:
# export FATHOM_SPLIT_SECONDS=300

vdxtr "https://..." --cookie-file ./cookie.txt --out-dir ./artifacts --pretty
```

### 4) Cookie options

Any of these work:
- `--cookie "name=value; other=value"`
- `--cookie-file ./cookie.txt`
- `VIDEO_EXTRACT_COOKIE=...` (preferred)
- `VIDEO_EXTRACT_COOKIE_FILE=...` (preferred)
- `FATHOM_COOKIE=...` (compat)
- `FATHOM_COOKIE_FILE=...` (compat)

Optional:
- `VIDEO_EXTRACT_USER_AGENT=...` (preferred; override the default `video-extract/<version>` user-agent)
- `FATHOM_USER_AGENT=...` (compat)

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
vdxtr "https://fathom.video/share/<TOKEN>" --cookie-file ./cookie.txt --out-dir ./artifacts --pretty
```

## What this repo does
- Extract transcript text (best-effort)
- Resolve media URLs
- Download media to `video.mp4`
- Split into N-second chunks (default 300s)

## What this repo does NOT do
- No LLM processing

## CLI flags (brief generator: `video-brief`)
- `--stdin` / `-`: read transcript/notes from stdin (use this when the share link is auth-gated)
- `--template`: generate a blank brief template (no URL fetch / no stdin required)
- `--copy`: copy the output to clipboard (best-effort; tries `pbcopy`, `clip.exe`/`clip`, `wl-copy`, `xclip`, or `xsel`)
- `--copy-brief`: copy the markdown brief to clipboard (even if `--json` is used)
- `--out <path>`: also write the output to a file (`--out -` means “stdout”)
- `--json`: output `{ source, title, brief }` as JSON instead of markdown
- `--compact-json`: when used with `--json`, output single-line JSON (useful for piping)
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
- `F2A_COMPACT_JSON=1` (behave as if `--compact-json` was passed)
- `F2A_OUT=<path>` (behave as if `--out <path>` was passed)
- `F2A_SOURCE=<url>` (behave as if `--source <url>` was passed)
- `F2A_TITLE=<text>` (behave as if `--title <text>` was passed)
- `F2A_CMD=<name>` (behave as if `--cmd <name>` was passed)
- `F2A_NO_NOTE=1` (behave as if `--no-note` was passed)

## CLI flags (extractor: `video-extract`)
- `--out-dir <dir>`: write `transcript.txt` + `extracted.json` + media artifacts
- `--cookie <cookie>` / `--cookie-file <path>`
- `--referer <url>` / `FATHOM_REFERER=...`: set an explicit `Referer` header (some auth flows/CDNs require this)
- `--user-agent <ua>` / `FATHOM_USER_AGENT=...`: override the `User-Agent` header used for fetch + media download
- `--split-seconds <n>` / `FATHOM_SPLIT_SECONDS=<n>`
- `--no-download` (skip video download)
- `--no-split` (download video but don’t split)
- `--download-media <path>` (set mp4 output path)
- `--pretty` (pretty JSON)

## Run locally

```bash
# install
bun install

# verify
bun run test
bun run lint
```

## Legacy commands (compat)

The old CLI names still work, but prefer the new ones in docs/scripts:
- `fathom2action` → `video-brief`
- `fathom-extract` → `video-extract` / `vdxtr`
