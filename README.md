# fathom2action

Turn a Fathom recording/link into an **engineering-actionable bug brief** (so you don’t watch the whole video).

## Install

```bash
npm i -g fathom2action
```

## Usage

```bash
# One-step: URL → (best-effort fetch) → markdown bug brief
fathom2action "https://..."

# Best current workflow: paste transcript/notes
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
pbpaste | fathom2action --stdin > bug.md
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
- Fetch/parse transcript from Fathom share pages when accessible
- Optional AI fill-in (OpenAI/other) to generate summary + repro steps
- One-command: create Linear/GitHub issue
