# Harvest Horizons — Assets Folder Scaffold

This scaffold matches the paths expected by your patched dashboard ZIP (index.html + data_processor.js + sessions.json + media.json).

## Required / recommended paths

### Hero background video (pick ONE)
- `assets/bg.mp4`  (preferred)
- `tmp.mp4`        (fallback)

If neither exists, the hero video will hide automatically.

### Placeholder (pick ONE; best to keep both)
- `assets/placeholder.svg` (preferred)
- `placeholder.svg`        (fallback)

### Media gallery base path
Media items are expected under:
- `assets/gallery/`

By default the JS will try these for each *media session id*:
- main video: `assets/gallery/<id>.mp4`
- main image: `assets/gallery/<id>.jpg`
- variant images: `assets/gallery/<id>_a.jpg`, ... `_f.jpg`

Variant videos are **disabled** by default (to avoid broken tiles).

A full expected-file list is in:
- `media_manifest_expected_files.csv`

## Brand images used by index.html (store at repo root)
The patched `index.html` references these at the repository root:
- `Bayer.jpg`
- `Buctril.jpg`
- `Atlantis.jpg`
- `Interact.gif`

If you store them elsewhere, update the `<img src="...">` paths in `index.html`.

## Notes
- If you have *different media per session* (not reusable by numeric id), switch to unique ids in `media.json` (and rename files accordingly). The current compact format assumes the same `<id>.jpg/mp4` can be reused across repeated ids.
