#!/usr/bin/env bash
# Render TikZ to SVG for Typst import.
# Bridges tikz-to-svg skill with typst-diagrams skill.
#
# Usage:
#   render-tikz-for-typst.sh input.tex              # SVG next to .tex
#   render-tikz-for-typst.sh input.tex figures/      # SVG in figures/

set -euo pipefail

INPUT="${1:?Usage: render-tikz-for-typst.sh input.tex [output-dir]}"
COMPILE_SCRIPT="$HOME/.claude/skills/tikz-to-svg/scripts/compile.sh"

if [[ ! -f "$COMPILE_SCRIPT" ]]; then
  echo "ERROR: tikz-to-svg skill not found at $COMPILE_SCRIPT" >&2
  echo "Install: the tikz-to-svg skill must be available" >&2
  exit 1
fi

BASENAME="$(basename "${INPUT%.tex}")"

if [[ -n "${2:-}" ]]; then
  OUTPUT_DIR="$2"
  mkdir -p "$OUTPUT_DIR"
  OUTPUT="$OUTPUT_DIR/${BASENAME}.svg"
else
  OUTPUT="$(dirname "$INPUT")/${BASENAME}.svg"
fi

bash "$COMPILE_SCRIPT" "$INPUT" "$OUTPUT"
echo "Ready for Typst: #tikz-fig(\"$OUTPUT\", caption: [...])"
