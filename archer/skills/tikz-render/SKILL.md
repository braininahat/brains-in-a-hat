---
name: tikz-render
description: This skill should be used when the user wants to "render a TikZ diagram", "compile LaTeX to SVG", "create an architecture diagram", "draw a neural network figure", "convert .tex to SVG", "use PetarV diagrams", "use nntikz", or asks to draw any specific architecture (BiGRU, BiMamba, JEPA, KAN, CTC trellis, ST-GCN, transformer, LSTM, ResNet). Handles both inline TikZ snippets and full .tex files. Outputs clean SVG files suitable for papers and dashboards.
---

# TikZ → SVG Compiler

Compile TikZ/LaTeX source into clean SVG via `pdflatex` + `dvisvgm`.

## Compilation (always use the script)

```bash
# From the plugin directory:
skills/tikz-render/scripts/compile.sh <input.tex> [output.svg]
```

The script handles wrapping, compilation, and conversion. Never reconstruct the pipeline from scratch — wrong flags (`--pdf` is mandatory, `--no-fonts` for portability) silently produce broken output.

**Input forms accepted:**
- Inline TikZ snippet (no `\documentclass`) → script wraps automatically
- Full `.tex` file with `\documentclass` → used as-is
- Write any snippet to a tmp file first: `echo "..." > /tmp/fig.tex`

## Choosing a Starting Template

Before writing TikZ from scratch, check existing libraries:

**Read `references/library-catalog.md`** for all available templates with verified raw GitHub URLs.

Quick decision:
- BiGRU, LSTM, Transformer, GRU → **nntikz** (`tikz/gru.tex`, `tikz/transformer.tex`)
- BiLSTM, Self-Attention, GCN, MPNN, MLP → **PetarV-/TikZ**
- 3D CNN block diagrams (ResNet/ConvNeXt) → **PlotNeuralNet** (Python→LaTeX)
- BiMamba, JEPA masking, KAN, CTC trellis, ST-GCN keypoints → no upstream template

## Custom Architectures (no template exists)

**Read `references/custom-architectures.md`** for working TikZ skeletons:
- BiMamba / Causal Mamba block
- JEPA masking diagram (context / target / EMA)
- KAN layer (B-spline edges)
- CTC trellis lattice
- ST-GCN tongue keypoint graph (16 keypoints)
- Full UltraSuite JEPA pipeline block diagram

## Fetching from a Library

```bash
# nntikz GRU (best for BiGRU paper figure)
curl -L "https://raw.githubusercontent.com/fraserlove/nntikz/master/tikz/gru.tex" -o /tmp/gru.tex
skills/tikz-render/scripts/compile.sh /tmp/gru.tex /tmp/gru.svg

# PetarV BiLSTM
curl -L "https://raw.githubusercontent.com/PetarV-/TikZ/master/Bidirectional%20long%20short-term%20memory/bidirectional_long_short-term_memory.tex" -o /tmp/bilstm.tex
skills/tikz-render/scripts/compile.sh /tmp/bilstm.tex /tmp/bilstm.svg
```

## Smoke Test

```bash
skills/tikz-render/scripts/compile.sh \
  skills/tikz-render/examples/minimal.tex /tmp/test.svg
# Expect: "SVG written to: /tmp/test.svg (XXXX bytes)"
```

## Error Handling

If `pdflatex` fails, the script prints the last 30 lines of the log. Common fixes:

| Error | Fix |
|-------|-----|
| `Undefined control sequence \usetikzlibrary` | Add library to preamble |
| `Package pgf Error` | Add `\usepackage{pgf}` |
| `Missing $ inserted` | Math mode issue — check node labels |
| `dvisvgm: no PDF file found` | pdflatex failed silently — check full log |

## Additional Resources

- **`references/library-catalog.md`** — all 5 TikZ sources with verified URLs and use-case guide
- **`references/custom-architectures.md`** — working stubs for BiMamba, JEPA, KAN, CTC, ST-GCN
- **`examples/minimal.tex`** — bare standalone for pipeline testing
- **`scripts/compile.sh`** — the full pdflatex+dvisvgm pipeline
