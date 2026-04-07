# ML Architecture Component Library

Reusable Typst/fletcher functions for common ML architectural components. Import fletcher and define the color palette before using these.

## Setup Preamble

Every diagram file should start with:

```typst
#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge
#import fletcher.shapes: house, hexagon, diamond, pill, cylinder
#set page(width: auto, height: auto, margin: 5mm, fill: white)
#set text(font: "New Computer Modern", size: 10pt)

// Semantic palette
#let C = (
  data:    rgb("#ef4444"),
  enc:     rgb("#3b82f6"),
  dec:     rgb("#14b8a6"),
  attn:    rgb("#f97316"),
  norm:    rgb("#eab308"),
  out:     rgb("#22c55e"),
  embed:   rgb("#8b5cf6"),
  hidden:  rgb("#6b7280"),
  loss:    rgb("#dc2626"),
)
```

## Base Node Function

All component functions build on this:

```typst
#let comp(pos, label, tint: white, w: 26mm, ..args) = node(
  pos, align(center, label),
  width: w,
  fill: tint.lighten(60%),
  stroke: 1pt + tint.darken(20%),
  corner-radius: 5pt,
  ..args,
)
```

## Component Catalog

### Data Nodes

```typst
// Raw input data (house shape = data source)
#let data-in(pos, label, ..a) = comp(pos, label, tint: C.data, shape: house.with(angle: 30deg), w: auto, ..a)

// Output / prediction (pill = terminal)
#let data-out(pos, label, ..a) = comp(pos, label, tint: C.out, shape: pill, w: 22mm, ..a)
```

### Encoder / Decoder

```typst
// Generic encoder block
#let encoder(pos, label, ..a) = comp(pos, label, tint: C.enc, ..a)

// Generic decoder block
#let decoder(pos, label, ..a) = comp(pos, label, tint: C.dec, ..a)

// Frame encoder (spatial: CNN, ResNet, ConvNeXt)
#let frame-enc(pos, label, ..a) = comp(pos, label, tint: C.enc, w: 30mm, ..a)

// Sequence encoder (temporal: BiGRU, BiMamba, Transformer, TCN)
#let seq-enc(pos, label, ..a) = comp(pos, label, tint: C.enc, w: 32mm, ..a)
```

### Attention / Gating

```typst
// Attention mechanism (hexagon = selective operation)
#let attention(pos, label, ..a) = comp(pos, label, tint: C.attn, shape: hexagon, ..a)

// Gated fusion (hexagon, gating semantics)
#let gated-fusion(pos, label, ..a) = comp(pos, label, tint: C.attn, shape: hexagon, ..a)

// Multi-head attention (wider, shows parallel heads)
#let multi-head(pos, label, ..a) = comp(pos, label, tint: C.attn, w: 34mm, ..a)
```

### Normalization / Regularization

```typst
// LayerNorm / BatchNorm (hexagon = transform)
#let norm(pos, label, ..a) = comp(pos, label, tint: C.norm, shape: hexagon, w: 22mm, ..a)

// Dropout / mask (dashed = stochastic)
#let mask(pos, label, ..a) = node(
  pos, align(center, label),
  width: 24mm, fill: C.hidden.lighten(80%),
  stroke: (dash: "dashed", thickness: 1pt, paint: C.hidden),
  corner-radius: 5pt, ..a,
)
```

### Heads / Output Layers

```typst
// CTC head
#let ctc-head(pos, label, ..a) = comp(pos, label, tint: C.out, ..a)

// Linear projection
#let linear(pos, label, ..a) = comp(pos, label, tint: C.enc, w: 22mm, ..a)

// KAN head (purple = learnable structure)
#let kan-head(pos, label, ..a) = comp(pos, label, tint: C.embed, ..a)
```

### Embedding / Latent

```typst
// Embedding layer
#let embedding(pos, label, ..a) = comp(pos, label, tint: C.embed, ..a)

// Latent / bottleneck
#let latent(pos, label, ..a) = comp(pos, label, tint: C.embed, shape: pill, w: 20mm, ..a)
```

### Loss Functions

```typst
// Loss node (diamond = computation)
#let loss(pos, label, ..a) = comp(pos, label, tint: C.loss, shape: diamond, w: 22mm, ..a)
```

### Structural

```typst
// Storage / database (cylinder)
#let storage(pos, label, ..a) = comp(pos, label, tint: C.hidden, shape: cylinder, w: 24mm, ..a)

// Group boundary (encloses other nodes)
#let group-box(nodes, label, tint: C.hidden) = node(
  enclose: nodes,
  align(top + right, text(size: 8pt, fill: tint)[#label]),
  stroke: (dash: "dashed", thickness: 0.5pt, paint: tint),
  corner-radius: 8pt,
  inset: 12pt,
)
```

## Edge Patterns

### Standard Data Flow
```typst
edge((0,0), (1,0), "-|>")                    // forward pass
```

### Skip / Residual Connection
```typst
edge((0,0), "r,dd,r", "-|>",                 // route: right, down, right
  stroke: C.hidden + 0.5pt, dash: "dashed")
```

### Bidirectional
```typst
edge((0,0), (1,0), "<->")                    // mutual information
```

### Loss Signal (backward)
```typst
edge((3,0), (2,0), "-|>",                    // gradient flow
  stroke: C.loss + 0.5pt, dash: "dashed")
```

### Multi-Head Fan-Out
```typst
// Fan from one node to multiple (attention heads)
for dx in (-.2, -.07, .07, .2) {
  edge((1, 1.7), (1 + dx, 1.7), (1 + dx, 1), "-|>")
}
```

### Labeled Edge
```typst
edge((0,0), (1,0), "-|>",
  label: text(size: 7pt)[$W x + b$],
  label-pos: 50%)
```

## Annotation Patterns

### Dimension Annotations
Use 7pt text inside nodes for shape/dimension info:
```typst
comp((0,0), [Encoder\ #text(size: 7pt)[(T, 256)]], tint: C.enc)
```

### Mathematical Notation
Use Typst math mode for formulas:
```typst
comp((0,0), [$sum_(i) sigma(W_i e_i) dot e_i$], tint: C.attn)
```

### Side-by-Side Comparison
```typst
#figure(
  grid(columns: 2, gutter: 12mm,
    diagram(/* variant A */),
    diagram(/* variant B */),
  ),
  caption: [Left: A. Right: B.],
)
```
