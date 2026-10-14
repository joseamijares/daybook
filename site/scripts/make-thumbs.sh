#!/bin/sh
# Small copies of the 44 paintings for the hung wall and the ledges, served as
# static files so they appear with the entrance animation (no on-demand image
# optimizer). Longest side 640px. Re-run when public/art changes; needs cwebp
# (brew install webp).
set -eu
cd "$(dirname "$0")/.."
mkdir -p public/art-small
for f in ../public/art/*.webp; do
  name=$(basename "$f")
  w=$(webpinfo "$f" 2>/dev/null | awk '/Width:/{print $2; exit}')
  h=$(webpinfo "$f" 2>/dev/null | awk '/Height:/{print $2; exit}')
  if [ "$w" -ge "$h" ]; then size="640 0"; else size="0 640"; fi
  # shellcheck disable=SC2086
  cwebp -quiet -q 78 -resize $size "$f" -o "public/art-small/$name"
done
echo "make-thumbs: $(ls public/art-small | wc -l | tr -d ' ') paintings, $(du -sh public/art-small | cut -f1)"
