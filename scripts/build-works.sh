#!/usr/bin/env bash
# Derives the site's web images from the raw photography archive
# (~116 MB of camera-native JPEG/PNG).
#
#   reel/  640px 16:9 centre-crop — film-strip frames, lazy-bound as WebGL textures
#   full/  1600px long edge, aspect preserved — the interiors carousel
#
# Also emits works.json: the ordered manifest both surfaces read.
# Re-runnable; skips derivatives that are newer than their source.
#
# The raws live OUTSIDE this repo on purpose — they are 116 MB and would
# bloat git history permanently. Override ROOT_SRC if the archive is
# somewhere other than the default sibling directory:
#
#   ROOT_SRC=/path/to/photography-raw bash scripts/build-works.sh

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$HERE")"
SRC="${ROOT_SRC:-$(dirname "$REPO")/commute-design-studio-source/photography-raw}"
OUT="$REPO/public/images/works"

[ -d "$SRC" ] || {
  echo "source not found: $SRC" >&2
  echo "The raw photography archive is not in this repo. Point ROOT_SRC at it:" >&2
  echo "  ROOT_SRC=/path/to/photography-raw bash scripts/build-works.sh" >&2
  exit 1
}
mkdir -p "$OUT/reel" "$OUT/full"

mapfile -d '' FILES < <(find "$SRC" -maxdepth 1 -type f \
  \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -print0 | sort -z)

echo "${#FILES[@]} source images"

i=0
for src in "${FILES[@]}"; do
  i=$((i + 1))
  id=$(printf '%03d' "$i")
  reel="$OUT/reel/$id.webp"
  full="$OUT/full/$id.webp"

  if [ ! -f "$reel" ] || [ "$src" -nt "$reel" ]; then
    magick "$src" -auto-orient -strip \
      -resize 'x720^' -gravity center -crop 1280x720+0+0 +repage \
      -resize 640x360 -quality 72 -define webp:method=5 "$reel" &
  fi

  if [ ! -f "$full" ] || [ "$src" -nt "$full" ]; then
    magick "$src" -auto-orient -strip \
      -resize '1600x1600>' -quality 80 -define webp:method=5 "$full" &
  fi

  # keep the fan-out near the core count
  while [ "$(jobs -rp | wc -l)" -ge 8 ]; do wait -n; done
done
wait

# ---- manifest -------------------------------------------------------------
# Captions are derived from the source filename only where it carries a real
# project name (Oretta, Alo, Midtown). Anything named Screenshot/IMG/DSC or a
# bare number gets no invented caption — the design system forbids fabricating
# project claims, so those stay untitled until the studio supplies copy.

python3 - "$SRC" "$OUT" <<'PY'
import json, re, sys
from pathlib import Path

src, out = Path(sys.argv[1]), Path(sys.argv[2])
files = sorted([p for p in src.iterdir()
                if p.is_file() and p.suffix.lower() in {'.jpg', '.jpeg', '.png'}])

def project(name: str):
    low = name.lower()
    if 'oretta' in low:   return 'Oretta'
    if 'alo' in low:      return 'Alo'
    if 'gioia' in low:    return 'Midtown — Gioia'
    if 'azurra' in low:   return 'Midtown — Azurra'
    if 'midtown' in low:  return 'Midtown'
    return None

items = []
for i, p in enumerate(files, 1):
    proj = project(p.name)
    items.append({
        'id':   f'{i:03d}',
        # Base-relative, no leading slash: asset() in modules/works.js
        # prepends import.meta.env.BASE_URL when it resolves these.
        'reel': f'images/works/reel/{i:03d}.webp',
        'full': f'images/works/full/{i:03d}.webp',
        'project': proj,
        # Alt text describes what a viewer gets; it never claims more than the
        # filename supports.
        'alt': (f'Interior by Commute Design Studio — {proj}' if proj
                else 'Interior by Commute Design Studio'),
        'source': p.name,
    })

(out / 'works.json').write_text(json.dumps(items, indent=1) + '\n')
named = sum(1 for it in items if it['project'])
print(f'{len(items)} entries, {named} with a project name')
PY

echo "reel: $(du -sh "$OUT/reel" | cut -f1)   full: $(du -sh "$OUT/full" | cut -f1)"
