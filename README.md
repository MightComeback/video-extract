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

```bash
# URL → JSON
fathom2action-extract "https://..." --pretty

# stdin → JSON (useful when the link is private/auth-gated)
pbpaste | fathom2action-extract --stdin --source "https://..." --pretty
```

### 2) Transform (JSON/raw text → markdown bug brief)

```bash
# Pipe extractor JSON → transformer markdown
fathom2action-extract "https://..." | fathom2action-transform --json > bug.md

# Or transform raw transcript/notes directly
pbpaste | fathom2action-transform --stdin --source "meeting notes" > bug.md
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
