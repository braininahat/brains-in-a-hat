---
name: arch-diagram
description: >
  This skill should be used when the user asks to "create an architecture diagram",
  "draw a figure for the paper", "make a publication-quality diagram",
  "visualize the model architecture", "diagram the pipeline", "typst diagram",
  "fletcher diagram", or needs scientific figures in Typst following
  petarv/janosh visual principles. Generates vector diagrams using
  fletcher/cetz with semantic color coding and a reusable ML component library.
---

# Publication-Quality ML Architecture Diagrams

Generate vector architecture diagrams in Typst using the fletcher package (built on cetz). Follows the visual principles of Petar Velickovic and Janosh Riebesell: mathematical precision, semantic color, minimalist clarity.

## Quick Start

Import the component library as a local Typst package. All colors, node types, edge helpers, and `ml-diagram` are available:

```typst
#import "@local/diagrams:0.1.0": *
```

For inline use in a full report (adds page/text settings):

```typst
#import "@local/diagrams:0.1.0": *
#set text(font: "New Computer Modern", size: 10pt)

// Inside the report body:
#figure(
  ml-diagram(
    data-in((0,0), [Poses\ #dim[(T, 22)]]),
    edge("-|>"),
    encoder((1,0), [BiGRU\ #dim[(T, 256)]]),
    edge("-|>"),
    ctc-head((2,0), [CTC\ #dim[46 classes]]),
    edge("-|>"),
    data-out((3,0), [Phonemes]),
  ),
  caption: [CTC pipeline],
)
```

For standalone diagram files (auto-sized page):

```typst
#import "@local/diagrams:0.1.0": *
#set page(width: auto, height: auto, margin: 5mm, fill: white)
#set text(font: "New Computer Modern", size: 10pt)

#ml-diagram(/* nodes and edges */)
```

Compile with: `typst compile diagram.typ diagram.pdf`

The package is installed at `~/.local/share/typst/packages/local/diagrams/0.1.0/` and symlinked to the skill's `lib.typ` so edits propagate automatically.

## Component System

Read `references/component-library.md` for the full catalog of reusable ML components. Key components:

| Component | Tint | Shape | When to Use |
|-----------|------|-------|-------------|
| `data-in` | red | house | Raw input data |
| `encoder` | blue | rect | Feature extraction layers |
| `decoder` | teal | rect | Generation/reconstruction |
| `attention` | orange | hexagon | Attention, gating, selection |
| `norm` | yellow | hexagon | Normalization, regularization |
| `ctc-head` | green | rect | CTC/classification output |
| `embedding` | purple | rect | Latent spaces, projections |
| `loss` | red | diamond | Loss computation |
| `mask` | gray | rect (dashed) | Dropout, masking, optional |

## Color System

Colors encode function, not decoration. See `references/color-system.md` for the full palette.

**Rule**: `fill: tint.lighten(60%)`, `stroke: 1pt + tint.darken(20%)`. ONE accent per diagram.

## Design Principles

Read `references/petarv-janosh-principles.md` for the full guide. Core rules:

1. **Math inside nodes**: Place equations in/beside nodes, not separately
2. **Semantic color only**: Every color encodes function. Remove color = lose information
3. **Progressive complexity**: Start with 3-5 nodes, add detail only where it clarifies
4. **Grid alignment**: All nodes snap to `(col, row)` coordinates
5. **Vector output only**: Always PDF or SVG, never rasterize

## When to Diagram vs. Not

**DO diagram**: data flow, transformations, architecture, temporal/spatial structure, comparison
**DON'T diagram**: enumerating lists, simple hierarchies (use tables), single-step operations

## Edge Patterns

```typst
edge((0,0), (1,0), "-|>")                              // forward flow
edge((0,0), "r,dd,r", "-|>", stroke: gray, dash: "dashed")  // residual/skip
edge((0,0), (1,0), "<->")                              // bidirectional
edge((0,0), (1,0), "-|>", label: text(7pt)[$W x$])     // labeled
```

Routing shorthand: `"r"` right, `"l"` left, `"u"` up, `"d"` down. Chain: `"l,uu,r"`.

## Side-by-Side Comparison

For comparing architectures (early vs late fusion, linear vs KAN):

```typst
#grid(columns: 2, gutter: 12mm,
  figure(diagram(/* variant A */), caption: [*A*: description]),
  figure(diagram(/* variant B */), caption: [*B*: description]),
)
```

## Fletcher API

Read `references/fletcher-api.md` for the complete API reference. Key features:
- 16 node shapes (rect, hexagon, house, pill, diamond, cylinder, ...)
- Edge decorations: `"wave"`, `"zigzag"`, `"coil"`
- Node grouping: `enclose` parameter to wrap other nodes
- Arrow marks: `"->"`, `"-|>"`, `"--|>"`, `"<->"`, `"=>"`

## Working Examples

Five compilable examples in `examples/`:

- **`ctc-pipeline.typ`** - CTC recognition: poses -> encoder -> seq model -> CTC -> phonemes
- **`encoder-decoder.typ`** - Generic encoder-decoder with cross-attention and residuals
- **`multimodal-fusion.typ`** - Early vs late fusion side-by-side comparison
- **`jepa-architecture.typ`** - I-JEPA self-supervised pre-training with EMA target encoder
- **`kan-vs-linear.typ`** - KAN spline head vs linear head interpretability comparison

Each is a standalone `.typ` file. Copy and adapt for new diagrams.

## Compilation

```bash
typst compile diagram.typ diagram.pdf     # PDF (default)
typst compile diagram.typ diagram.svg     # SVG
typst compile diagram.typ diagram.png --ppi 300  # PNG at 300 DPI
```

Or use the helper: `bash scripts/compile-diagram.sh diagram.typ --format svg`
