# Deploy (Option A layout)

This dashboard is designed for GitHub Pages with this layout:

- Root:
  - index.html
  - dashboard.js
  - style.css
  - sheets.html
  - details.html
  - healthcheck.html
  - data/...
- assets/:
  - gallery/...(images/videos)
  - signatures/...(png)
  - placeholder.svg, placeholder-video.mp4, etc

## IMPORTANT (remove duplicates)
If your repo currently has these files inside `assets/`:
- assets/index.html
- assets/dashboard.js
- assets/style.css

Delete them. The live site should load root files only.

## Verify
After deployment, open:
- healthcheck.html
- index.html?campaign=buctril-super-2025#sessions

If media does not load, confirm files exist under:
- assets/gallery/<filename>
matching EXACT case and extension referenced by sessions.json.
