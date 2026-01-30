# MIG-14

Implementation notes / checklist for migration work.

## Definition of done (draft)
- CLI `fathom2action`:
  - [x] Accepts Fathom share links and renders a copy/paste-ready bug brief.
  - [x] Supports auth-gated fallback: prints a brief + hint to re-run with `--stdin`.
  - [x] Supports `--stdin` envelope parsing (optional Source/Title lines).
  - [x] Supports `--json` and `--copy`/`--copy-brief`.
- CLI `fathom-extract`:
  - [x] Best-effort transcript extraction.
  - [x] Optional media download + splitting (ffmpeg).
- Repo:
  - [x] `npm test` green.
  - [x] README has copy/paste examples.

(Linear remains the source of truth; this file is just a local checklist.)
