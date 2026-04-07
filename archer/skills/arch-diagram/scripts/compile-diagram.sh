#!/usr/bin/env bash
# Compile a Typst diagram to PDF (default), SVG, or PNG.
# Usage:
#   compile-diagram.sh input.typ              # → input.pdf
#   compile-diagram.sh input.typ --format svg # → input.svg
#   compile-diagram.sh input.typ --format png # → input.png

set -euo pipefail

INPUT="${1:?Usage: compile-diagram.sh input.typ [--format pdf|svg|png]}"
FORMAT="pdf"

if [[ "${2:-}" == "--format" ]]; then
  FORMAT="${3:-pdf}"
fi

OUTPUT="${INPUT%.typ}.${FORMAT}"

case "$FORMAT" in
  pdf|svg)
    typst compile "$INPUT" "$OUTPUT"
    ;;
  png)
    typst compile "$INPUT" "$OUTPUT" --ppi 300
    ;;
  *)
    echo "Unknown format: $FORMAT (use pdf, svg, or png)" >&2
    exit 1
    ;;
esac

echo "Compiled: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
