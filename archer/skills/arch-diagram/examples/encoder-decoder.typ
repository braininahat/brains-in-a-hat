// Generic Encoder-Decoder with Cross-Attention

#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge
#import fletcher.shapes: house, pill, hexagon
#set page(width: auto, height: auto, margin: 5mm, fill: white)
#set text(font: "New Computer Modern", size: 10pt)

#let C = (
  data: rgb("#ef4444"), enc: rgb("#3b82f6"),
  dec: rgb("#14b8a6"), attn: rgb("#f97316"),
  norm: rgb("#eab308"), out: rgb("#22c55e"),
  embed: rgb("#8b5cf6"), hidden: rgb("#6b7280"),
)

#let comp(pos, label, tint: white, w: 26mm, ..args) = node(
  pos, align(center, label), width: w,
  fill: tint.lighten(60%), stroke: 1pt + tint.darken(20%),
  corner-radius: 5pt, ..args,
)

#diagram(
  spacing: (12mm, 12mm),
  edge-stroke: 1pt,
  mark-scale: 70%,

  // ── Encoder stack (left) ──
  comp((0,3), [Input $x$], tint: C.data, shape: house.with(angle: 30deg), w: auto),
  edge("-|>"),
  comp((0,2), [Embedding\ + Pos Enc], tint: C.embed),
  edge("-|>"),
  comp((0,1), [Self-Attn\ #text(size: 7pt, fill: gray)[multi-head]], tint: C.attn, shape: hexagon),
  edge("-|>"),
  comp((0,0), [Add & Norm], tint: C.norm, shape: hexagon, w: 22mm),

  // Encoder residual
  edge((0,2), "l,uu,r", "-|>", stroke: C.hidden + 0.5pt, dash: "dashed"),

  // ── Decoder stack (right) ──
  comp((2,3), [Target $y$], tint: C.data, shape: house.with(angle: 30deg), w: auto),
  edge("-|>"),
  comp((2,2), [Embedding\ + Pos Enc], tint: C.embed),
  edge("-|>"),
  comp((2,1), [Masked\ Self-Attn], tint: C.attn, shape: hexagon),
  edge("-|>"),
  comp((2,0), [Add & Norm], tint: C.norm, shape: hexagon, w: 22mm),

  // Decoder residual
  edge((2,2), "r,uu,l", "-|>", stroke: C.hidden + 0.5pt, dash: "dashed"),

  // ── Cross-attention (center, connecting encoder to decoder) ──
  comp((1,-1), [Cross-Attn\ #text(size: 7pt, fill: gray)[K,V from encoder\ Q from decoder]], tint: C.attn, shape: hexagon, w: 30mm),

  // Encoder output → cross-attn K,V
  edge((0,0), (1,-1), "-|>", label: text(size: 7pt)[K, V]),
  // Decoder output → cross-attn Q
  edge((2,0), (1,-1), "-|>", label: text(size: 7pt)[Q], label-side: right),

  // Cross-attn → output
  comp((1,-2), [FFN + Norm], tint: C.enc, w: 24mm),
  edge((1,-1), (1,-2), "-|>"),

  comp((1,-3), [Output], tint: C.out, shape: pill, w: 20mm),
  edge((1,-2), (1,-3), "-|>"),
)
