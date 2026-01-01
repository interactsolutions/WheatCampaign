# Deploy to GitHub Pages (Recommended layout)

This dashboard is a static site. GitHub Pages works best when the repository root contains the HTML/JS/CSS plus `data/` and `assets/`.

## 1) Repository structure
Place these at the repo root:
- `index.html`
- `details.html`
- `sheets.html`
- `healthcheck.html`
- `style.css`
- `dashboard.js`
- `data/`
- `assets/`

## 2) Turn on GitHub Pages
GitHub → **Settings** → **Pages**
- Source: **Deploy from a branch**
- Branch: `main` (or your default) / folder: `/ (root)`

## 3) Verify the deployment
After Pages builds, open:
- Dashboard: `https://<org>.github.io/<repo>/`
- Healthcheck: `https://<org>.github.io/<repo>/healthcheck.html`

Healthcheck should report `OK` for:
- `data/campaigns.json`
- `data/<campaignId>/sessions.json`
- `data/<campaignId>/sheets_index.json`

## 4) Common failure modes (fast checklist)
1. **Wrong paths**: media files must be referenced relative to the site root (typically `assets/gallery/...`).
2. **Case sensitivity**: GitHub Pages is case‑sensitive. `IMG_01.jpeg` ≠ `img_01.jpeg`.
3. **Extensions**: ensure the file extension in JSON matches the actual asset (`.jpeg` vs `.jpg`).
4. **Caching**: when you update `style.css` or `dashboard.js`, bump the version querystring in the HTML (e.g., `style.css?v=YYYYMMDD`) to bypass browser cache.

## 5) Updating campaign data
- Add/update campaign data under `data/<campaignId>/`
- Register/adjust in `data/campaigns.json`
- Push to the Pages branch and re‑run Healthcheck
