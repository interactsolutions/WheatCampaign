Place session images/videos here to eliminate 404 errors.

Expected paths
- Sessions currently reference media like: gallery/17a.jpeg
- The dashboard resolves that to: assets/gallery/17a.jpeg

So, for each referenced file, ensure it exists at:
  assets/gallery/<filename>

If you prefer campaign-specific folders:
  assets/gallery/buctril-super-2025/<filename>

Then update sessions.json to reference:
  gallery/buctril-super-2025/<filename>

Validation
- Run: python tools/validate_assets.py --campaign buctril-super-2025
