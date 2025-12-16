# WheatCampaign – Pages Fix v3

This package updates **data_processor.js** to address:
1) Media not loading when files are named `1a.jpg`/`1a.jpeg`/`1a.mp4` (no underscore) OR `1_a.jpg`.
2) Media stored either in `assets/gallery/` OR in repo root.
3) sessions coordinates when longitude key is `lon`, `lng`, `long`, or `longitude`.
4) Better diagnostics for Git LFS pointer files (common reason media won't load on GitHub Pages).

## Important (Git LFS)
If your media files are tracked via **Git LFS**, GitHub Pages typically serves the *pointer text file*, not the binary.
If the debug panel logs: 'Git LFS pointer detected', you must remove LFS for those files or host media elsewhere.

## Expected locations
- `index.html`, `data_processor.js`, `sessions.json`, `media.json` in repository root.
- Media can be in either:
  - `assets/gallery/` (recommended), or
  - repository root (works with v3 fallback)

