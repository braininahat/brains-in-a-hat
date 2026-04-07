#!/usr/bin/env bash
# compile.sh — TikZ/LaTeX → SVG
# Usage: compile.sh <input.tex> [output.svg]
#
# If input.tex lacks \documentclass, wraps it in a standalone doc first.
# Output defaults to <input-basename>.svg in the same directory as input.

set -euo pipefail

INPUT="${1:-}"
OUTPUT="${2:-}"

if [[ -z "$INPUT" ]]; then
  echo "Usage: compile.sh <input.tex> [output.svg]" >&2
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Error: file not found: $INPUT" >&2
  exit 1
fi

# Default output path
if [[ -z "$OUTPUT" ]]; then
  OUTPUT="${INPUT%.tex}.svg"
fi

TMPDIR=$(mktemp -d /tmp/tikz2svg.XXXXXX)
trap 'rm -rf "$TMPDIR"' EXIT

# Wrap in standalone doc if no \documentclass
if grep -q '\\documentclass' "$INPUT"; then
  cp "$INPUT" "$TMPDIR/fig.tex"
else
  cat > "$TMPDIR/fig.tex" << 'LATEX_EOF'
\documentclass[tikz,border=4pt]{standalone}
\usepackage{tikz}
\usepackage{pgfplots}
\pgfplotsset{compat=newest}
LATEX_EOF
  cat "$INPUT" >> "$TMPDIR/fig.tex"
fi

# Compile PDF
cd "$TMPDIR"
if ! pdflatex -interaction=nonstopmode fig.tex > "$TMPDIR/pdflatex.log" 2>&1; then
  echo "=== pdflatex FAILED ===" >&2
  tail -30 "$TMPDIR/pdflatex.log" >&2
  exit 1
fi

# Convert to SVG
# --pdf: input is PDF (not DVI)
# --no-fonts: embed text as paths (portability)
if ! dvisvgm --pdf --no-fonts fig.pdf -o fig.svg >> "$TMPDIR/pdflatex.log" 2>&1; then
  echo "=== dvisvgm FAILED ===" >&2
  tail -20 "$TMPDIR/pdflatex.log" >&2
  exit 1
fi

cp "$TMPDIR/fig.svg" "$OUTPUT"
echo "SVG written to: $OUTPUT ($(wc -c < "$OUTPUT") bytes)"
