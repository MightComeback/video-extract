# MIG-14

Implementation notes / checklist for migration work.

## Definition of done (draft)
- CLI `fathom2action`:
  - Accepts Fathom share links and renders a copy/paste-ready bug brief.
  - Supports auth-gated fallback: prints a brief + hint to re-run with `--stdin`.
  - Supports `--stdin` envelope parsing (optional Source/Title lines).
  - Supports `--json` and `--copy`/`--copy-brief`.
- CLI `fathom-extract`:
  - Best-effort transcript extraction.
  - Optional media download + splitting (ffmpeg).
- Repo:
  - `npm test` green.
  - README has copy/paste examples.

(Linear remains the source of truth; this file is just a local checklist.)
