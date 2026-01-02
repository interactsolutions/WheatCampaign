# INTERACT Field Intelligence Dashboard (Multi‑Campaign)

This repository hosts a static, GitHub‑Pages friendly dashboard that converts field session sheets (e.g., D1S1…D13S3) into an **outcome‑oriented campaign report**:
- **Reach**: sessions, farmers reached, acres engaged
- **Conversion funnel** (weighted by farmers present): awareness → used last year → definite intent (plus maybe / not interested)
- **Impact proxy**: estimated product acres influenced (when provided in the sheet)
- **Execution focus**: priority districts, top adoption drivers, top barriers, and session‑level recommended actions

## What this build is optimized for
- **Report accuracy**: campaign totals are computed from **session rows only** (not the spreadsheet’s top summary row) so the dashboard matches your XLSX session totals.
- **Reliability on mobile**: responsive layout, safe‑area support, and resilient media loading.
- **Operational usefulness**: the UI emphasizes “what happened” and “what to do next” instead of raw tables.

## Data model (per campaign)
Create a folder at `data/<campaignId>/` and include:
- `sessions.json` (required): session records + metrics + geo + media references
- `sheets_index.json` (recommended): per‑sheet farmers/acres totals for accurate weighting
- `sheets/*.json` (optional but recommended): raw sheet exports used in the drawer and “Open sheet”
- `media.json` (optional): structured campaign media index

Register campaigns in `data/campaigns.json`.

## Score logic (session score)
Session score is computed from the session’s captured outcomes:
- Definite intent (35%)
- Awareness (25%)
- Used last year (15%)
- Understanding (25%, normalized from 0–3 to 0–100)

## Healthcheck
Open `healthcheck.html` to validate that core JSON files load successfully. It is designed to quickly diagnose broken paths during GitHub Pages deployment.

## Deploy to GitHub Pages
Copy these items to your GitHub Pages repo root:
- `index.html`
- `details.html`
- `sheets.html`
- `healthcheck.html`
- `style.css`
- `dashboard.js`
- `data/`
- `assets/` (images, videos, signatures, gallery)
