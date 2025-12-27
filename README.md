# INTERACT Multi‑Campaign Field Intelligence Dashboard (v2)

## What this fixes
- **Totals/KPIs mismatch** caused by the spreadsheet's **top summary row**:
  - This build computes totals strictly from **session rows only** (40 sessions), matching the XLSX and expected campaign totals.
- **iPhone / mobile rendering**:
  - Mobile-first layout, safe-area support, table-to-card fallback, reduced-motion, and iOS video autoplay fallback.
- **Session Score**:
  - 35% Definite Use + 25% Awareness + 15% Used Last Year + 25% Understanding (normalized from 0–3 to 0–100).

## Multi-campaign
1. Add a campaign folder: `data/<campaignId>/`
2. Place:
   - `sessions.json`
   - `media.json`
3. Register it in `data/campaigns.json`

## Deploy
Copy these files/folders to your GitHub Pages repo root:
- `index.html`
- `style.css`
- `dashboard.js`
- `data/`
Keep your existing `assets/` folder as-is (images/videos/gallery).

