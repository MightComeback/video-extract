# Contributing

## Setup

```bash
npm install
```

## Testing

Run the full test suite (Node test runner):

```bash
npm test
```

Linting:

```bash
npm run lint
```

## Project Structure

- `bin/`: CLI entry points.
- `src/`: Core logic (`brief.js` generates markdown, `extractor.js` handles Fathom extraction).
- `test/`: Unit tests.
- `scripts/`: Helper scripts (release, linear check).

## Releasing

To cut a new release (v0.1.0, etc):

1. Update version in `package.json`
2. Run `./scripts/release.sh`
