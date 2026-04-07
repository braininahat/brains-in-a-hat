# Semantic Color System

## Palette

Colors follow a functional semantics — each color encodes the *role* of a component, not its importance.

| Role | Typst Color | Hex | Usage |
|------|------------|-----|-------|
| Data / Input | `red` | `#ef4444` | Raw data, observations, input tensors |
| Encoder / Processing | `blue` | `#3b82f6` | Feature extraction, encoding layers |
| Decoder / Generation | `teal` | `#14b8a6` | Reconstruction, generation, decoding |
| Attention / Gating | `orange` | `#f97316` | Attention heads, gated mechanisms, selection |
| Normalization / Regularization | `yellow` | `#eab308` | LayerNorm, BatchNorm, dropout, regularizers |
| Output / Prediction | `green` | `#22c55e` | Final predictions, CTC output, classification |
| Embedding / Latent | `purple` | `#8b5cf6` | Latent spaces, embeddings, projections |
| Hidden / Intermediate | `gray` | `#6b7280` | Intermediate representations, skip layers |
| Loss / Error | `red` | `#dc2626` | Loss functions, error signals (darker than input red) |
| Disabled / Optional | `gray` | `#9ca3af` | Dashed stroke, optional components |

## Application Rules

### Node Fill and Stroke
```typst
fill: tint.lighten(60%)      // Pastel fill
stroke: 1pt + tint.darken(20%)  // Darker border
```

### Accent Rule
Use ONE accent color per diagram for the component being emphasized. All other nodes use their semantic color at reduced saturation or grayscale.

### Edge Styling
- **Data flow**: solid 1pt black or dark gray
- **Skip/residual connections**: dashed gray, routed with `"l,uu,r"` or `bend`
- **Optional paths**: dotted gray
- **Loss gradients**: dashed red, reversed arrows

### Typst Definition Block
```typst
// Import at top of every diagram file
#let colors = (
  data:    rgb("#ef4444"),
  encoder: rgb("#3b82f6"),
  decoder: rgb("#14b8a6"),
  attn:    rgb("#f97316"),
  norm:    rgb("#eab308"),
  output:  rgb("#22c55e"),
  embed:   rgb("#8b5cf6"),
  hidden:  rgb("#6b7280"),
  loss:    rgb("#dc2626"),
)
```

### Dark Theme Variant
For dark backgrounds, invert the lighten/darken:
```typst
fill: tint.darken(60%)
stroke: 1pt + tint.lighten(20%)
```
