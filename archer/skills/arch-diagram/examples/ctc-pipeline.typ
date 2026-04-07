// CTC Phoneme Recognition Pipeline
// Pose keypoints → frame encoder → sequence encoder → CTC head → phonemes

#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge
#import fletcher.shapes: house, pill
#set page(width: auto, height: auto, margin: 5mm, fill: white)
#set text(font: "New Computer Modern", size: 10pt)

#let C = (
  data: rgb("#ef4444"), enc: rgb("#3b82f6"),
  norm: rgb("#eab308"), out: rgb("#22c55e"), embed: rgb("#8b5cf6"),
  loss: rgb("#dc2626"),
)

#let comp(pos, label, tint: white, w: 26mm, ..args) = node(
  pos, align(center, label), width: w,
  fill: tint.lighten(60%), stroke: 1pt + tint.darken(20%),
  corner-radius: 5pt, ..args,
)

#diagram(
  spacing: (14mm, 10mm),
  edge-stroke: 1pt,
  mark-scale: 70%,

  // Main pipeline
  comp((0,0), [Tongue Poses\ #text(size: 7pt, fill: gray)[(T, 22) mm-space]], tint: C.data, shape: house.with(angle: 30deg), w: auto),
  edge("-|>"),
  comp((1,0), [InputLayerNorm\ #text(size: 7pt, fill: gray)[no data norm]], tint: C.norm, w: 28mm),
  edge("-|>"),
  comp((2,0), [Frame Encoder\ #text(size: 7pt, fill: gray)[CNN1D, stride 4\ (T, 22) #sym.arrow (T/4, 256)]], tint: C.enc, w: 32mm),
  edge("-|>"),
  comp((3,0), [Seq Encoder\ #text(size: 7pt, fill: gray)[BiGRU / BiMamba /\ Transformer / TCN]], tint: C.enc, w: 32mm),
  edge("-|>"),
  comp((4,0), [CTC Head\ #text(size: 7pt, fill: gray)[Linear #sym.arrow 46]], tint: C.out, w: 24mm),
  edge("-|>"),
  comp((5,0), [Phonemes], tint: C.embed, shape: pill, w: 22mm),

  // CTC loss below
  comp((4,1), [$cal(L)_"CTC"$], tint: C.loss, w: 18mm),
  edge((4,0), (4,1), "-|>", stroke: C.loss + 0.8pt, dash: "dashed"),
)
