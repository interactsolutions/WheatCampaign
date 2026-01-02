#!/usr/bin/env python3
"""Validate gallery assets referenced by sessions.json.

Usage:
  python tools/validate_assets.py --campaign buctril-super-2025

This script scans:
  data/<campaign>/sessions.json

And checks that each referenced media file exists under the repository root
after applying the same normalization used by dashboard.js:
  - "gallery/..." -> "assets/gallery/..."
  - "assets/..."  -> "assets/..."
  - other relative paths -> "assets/gallery/<path>"

It prints missing files and exits non-zero if any are missing.
"""

from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys

def normalize(p: str) -> str:
    p = (p or '').strip()
    if not p:
        return ''
    if p.startswith('http://') or p.startswith('https://') or p.startswith('data:') or p.startswith('blob:'):
        return p
    if p.startswith('gallery/'):
        return 'assets/' + p
    if p.startswith('assets/'):
        return p
    return 'assets/gallery/' + p.lstrip('/')

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--campaign', required=True, help='Campaign id, e.g., buctril-super-2025')
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    sessions_path = root / 'data' / args.campaign / 'sessions.json'
    if not sessions_path.exists():
        print(f'ERROR: {sessions_path} not found', file=sys.stderr)
        return 2

    data = json.loads(sessions_path.read_text(encoding='utf-8'))
    sessions = data.get('sessions') or []
    missing = []
    total = 0

    for s in sessions:
        media = s.get('media') or {}
        for kind in ('images', 'videos'):
            for item in media.get(kind) or []:
                total += 1
                n = normalize(str(item))
                if n.startswith('http'):
                    continue
                fp = root / n
                if not fp.exists():
                    missing.append(n)

    if missing:
        print(f'MISSING {len(missing)} / {total} referenced media files:')
        for p in sorted(set(missing)):
            print('  -', p)
        print('\nFix options:')
        print('  1) Upload the missing files to the exact paths above, OR')
        print('  2) Update sessions.json so media paths match what you actually deployed.')
        return 1

    print(f'OK: all {total} referenced media files exist locally.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
