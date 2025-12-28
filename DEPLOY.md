# INTERACT WheatCampaign Dashboard (Revamp v6)

## What this build fixes
- **Header video sequence** is enforced in code (Bayer → INTERACT → Buctril → Atlantis). If any MP4 fails to load or autoplay is blocked (common on iPhone), it automatically falls back to the corresponding image/GIF.
- **Gallery only shows session media** under `assets/gallery/*` and only the media linked to the currently filtered sessions.
- **District selection updates everything**: KPIs, charts, map markers, sessions list, and gallery.
- **Map shows spots by default** (filtered selection). Clicking a marker opens session details (host, contacts, intent, reasons, competitors, and session media).
- **Graphs added** (Chart.js): adoption funnel, district coverage, understanding, top reasons to use.
- **Sum row glitch avoided**: all totals are recomputed from session rows. The summary row is ignored in the generated sessions dataset.

## Required repo structure
Place these files at repository root (same level as `index.html`):
- `index.html`
- `style.css`
- `dashboard.js`
- `healthcheck.html`
- `data/campaigns.json`
- `data/buctril-super-2025/sessions.json`
- `data/buctril-super-2025/media.json`

Assets:
- `assets/bg.mp4`
- Header videos: `assets/bayer.mp4`, `assets/interact.mp4` (optional), `assets/buctril.mp4`, `assets/atlantis.mp4`
- Brand images fallbacks: `assets/Interact.gif`, `assets/Bayer.png`, `assets/Buctril.jpg`, `assets/Atlantis.jpg`
- Placeholder: `assets/placeholder.svg`
- Session media only: `assets/gallery/*` (photos/videos)

## Diagnostics
Open `healthcheck.html`. It will verify that the JSON + critical assets are reachable on GitHub Pages and show HTTP status codes.

## Multi-campaign
Add new campaigns in `data/campaigns.json` by creating:
- `data/<campaign-id>/sessions.json`
- `data/<campaign-id>/media.json`
And configuring assets and paths in the campaign object.
