// Early vs Late Fusion — side-by-side comparison

#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge
#import fletcher.shapes: hexagon, pill
#set page(width: auto, height: auto, margin: 5mm, fill: white)
#set text(font: "New Computer Modern", size: 10pt)

#let C = (
  data: rgb("#ef4444"), enc: rgb("#3b82f6"),
  attn: rgb("#f97316"), out: rgb("#22c55e"), embed: rgb("#8b5cf6"),
)

#let comp(pos, label, tint: white, w: 22mm, ..args) = node(
  pos, align(center, label), width: w,
  fill: tint.lighten(60%), stroke: 1pt + tint.darken(20%),
  corner-radius: 5pt, ..args,
)

#grid(
  columns: 2,
  gutter: 16mm,

  // ── Early Fusion ──
  figure(
    diagram(
      spacing: (10mm, 10mm),
      edge-stroke: 1pt,
      mark-scale: 60%,

      comp((0,0), [Pose\ Encoder\ #text(size: 7pt, fill: gray)[(T, 256)]], tint: C.data, w: 24mm),
      comp((0,1), [Audio\ Encoder\ #text(size: 7pt, fill: gray)[(T, 256)]], tint: C.attn, w: 24mm),
      comp((1,0.5), [Gated\ Fusion\ #text(size: 7pt, fill: gray)[$sigma(W e) dot e$]], tint: C.attn, shape: hexagon, w: 24mm),
      comp((2,0.5), [CTC\ Head], tint: C.out, w: 20mm),
      comp((3,0.5), [Phonemes], tint: C.embed, shape: pill, w: 20mm),

      edge((0,0), (1,0.5), "-|>"),
      edge((0,1), (1,0.5), "-|>"),
      edge((1,0.5), (2,0.5), "-|>"),
      edge((2,0.5), (3,0.5), "-|>"),
    ),
    caption: [*Early fusion*: single CTC head\ on fused embeddings],
  ),

  // ── Late Fusion ──
  figure(
    diagram(
      spacing: (10mm, 10mm),
      edge-stroke: 1pt,
      mark-scale: 60%,

      comp((0,0), [Pose\ Encoder], tint: C.data, w: 20mm),
      comp((1,0), [CTC#sub[p]], tint: C.out, w: 18mm),
      comp((0,1), [Audio\ Encoder], tint: C.attn, w: 20mm),
      comp((1,1), [CTC#sub[a]], tint: C.out, w: 18mm),
      comp((2,0.5), [$product$\ Fuse], tint: C.embed, shape: hexagon, w: 18mm),
      comp((3,0.5), [Phonemes], tint: C.embed, shape: pill, w: 20mm),

      edge((0,0), (1,0), "-|>"),
      edge((0,1), (1,1), "-|>"),
      edge((1,0), (2,0.5), "-|>"),
      edge((1,1), (2,0.5), "-|>"),
      edge((2,0.5), (3,0.5), "-|>"),
    ),
    caption: [*Late fusion*: separate CTC models,\ predictions combined at inference],
  ),
)
