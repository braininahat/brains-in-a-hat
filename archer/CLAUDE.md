# archer — Publication-Quality Scientific Visualization

**archer** = **arch**itecture + figur**er**

A brains-in-a-hat plugin for producing publication-ready scientific figures: ML architecture diagrams, TikZ renderings, Typst research reports, and matplotlib/plotly data plots.

## What archer does

- **Architecture diagrams** via Typst + fletcher (`arch-diagram` skill) — data flow, pipeline stages, ML components with semantic color coding
- **Structural/dimensional figures** via TikZ + pdflatex/dvisvgm (`tikz-render` skill) — cell internals, lattices, keypoint graphs, geometric layouts
- **Full Typst reports** (`typst-report` skill) — mixed fletcher + TikZ SVG documents with numbered figures, cross-references, and publication typography
- **Data plots** (`plot-figure` skill) — matplotlib/plotly → SVG with font/style settings matching New Computer Modern
- **Multi-panel composition** (`figure-compose` skill) — Typst grid layouts for subfigure panels

## The Two Diagram Systems

| System | When to use | Skill | Output |
|--------|-------------|-------|--------|
| **fletcher** (Typst) | Data flow, pipeline stages, encoder/decoder blocks | `arch-diagram` | PDF / SVG |
| **TikZ** (LaTeX) | Cell internals, lattices, geometric/spatial, keypoint graphs | `tikz-render` | SVG |

**Rule of thumb**: if you're showing *what flows where*, use fletcher. If you're showing *what's inside a cell* or *how geometry works*, use TikZ.

## Installation

```bash
cc --plugin-dir /path/to/archer
```

Or symlink into the plugin search path:
```bash
ln -s /path/to/archer ~/.claude/plugins/archer
```

## Dependencies

| Tool | Install |
|------|---------|
| `typst-cli` | `cargo install typst-cli` |
| `pdflatex` | `sudo apt install texlive-full` (or MacTeX) |
| `dvisvgm` | included with texlive-full |

## @local/diagrams:0.1.0 (Typst package)

The `arch-diagram` skill uses a local Typst package. It must be installed once:

```bash
mkdir -p ~/.local/share/typst/packages/local/diagrams/0.1.0
cp skills/arch-diagram/lib.typ ~/.local/share/typst/packages/local/diagrams/0.1.0/

# Or symlink so edits to lib.typ propagate automatically:
ln -s "$(pwd)/skills/arch-diagram/lib.typ" \
      ~/.local/share/typst/packages/local/diagrams/0.1.0/lib.typ
```

Verify: `typst compile --check skills/arch-diagram/examples/ctc-pipeline.typ`

## Quick Start

```bash
# Create an architecture diagram
/diagram Draw the CTC pipeline: poses → CNN1D → BiGRU → CTC → phonemes

# Render all figures in a directory
/render-figures paper/figures/

# Review a figure for publication quality
# (activate the figure-reviewer agent)
```

## Skills Reference

| Skill | Trigger phrases |
|-------|----------------|
| `arch-diagram` | "architecture diagram", "fletcher diagram", "visualize the model", "draw the pipeline" |
| `tikz-render` | "TikZ figure", "compile LaTeX", "cell internals", "convert .tex to SVG" |
| `typst-report` | "create a report", "write a Typst report", "research report PDF" |
| `plot-figure` | "create a plot", "training curves", "ablation chart", "visualize metrics" |
| `figure-compose` | "combine figures", "multi-panel", "arrange subfigures", "figure grid" |
