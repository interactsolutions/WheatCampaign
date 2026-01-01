#!/usr/bin/env python3
"""Build a gallery manifest from assets/gallery.

Usage:
  python tools/build_gallery_manifest.py --campaign buctril-super-2025

Outputs:
  data/<campaign>/gallery_manifest.json

The manifest can be used by future UI enhancements, and gives you a single file
to verify what's deployed on GitHub Pages.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import mimetypes

IMAGE_EXT = {'.jpg','.jpeg','.png','.webp','.gif','.svg'}
VIDEO_EXT = {'.mp4','.webm','.mov'}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--campaign', required=True)
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    base = root / 'assets' / 'gallery'
    if not base.exists():
        print(f'No gallery folder found at {base}. Create it and add media first.')
        return 2

    # If you want campaign-specific folders, put them under assets/gallery/<campaign>/
    candidate = base / args.campaign
    scan_root = candidate if candidate.exists() else base

    images, videos, other = [], [], []
    for p in sorted(scan_root.rglob('*')):
        if not p.is_file():
            continue
        rel = p.relative_to(root).as_posix()
        ext = p.suffix.lower()
        if ext in IMAGE_EXT:
            images.append(rel)
        elif ext in VIDEO_EXT:
            videos.append(rel)
        else:
            other.append(rel)

    out = {
        "campaign": args.campaign,
        "scanRoot": scan_root.relative_to(root).as_posix(),
        "images": images,
        "videos": videos,
        "other": other
    }

    out_path = root / 'data' / args.campaign / 'gallery_manifest.json'
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Wrote {out_path} with {len(images)} images and {len(videos)} videos.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
