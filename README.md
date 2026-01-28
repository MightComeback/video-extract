# fathom2action

Turn a Fathom recording/link into an **engineering-actionable bug brief** (so you don’t watch the whole video).

## Install

```bash
npm i -g fathom2action
```

## Usage

```bash
# If you have a Fathom link (MVP prints a bug-brief scaffold)
fathom2action "https://..."

# Best current workflow: paste transcript/notes
pbpaste | fathom2action --stdin > bug.md
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
