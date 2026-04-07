// I-JEPA / V-JEPA Self-Supervised Pre-training Architecture

#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge
#import fletcher.shapes: hexagon
#set page(width: auto, height: auto, margin: 5mm, fill: white)
#set text(font: "New Computer Modern", size: 10pt)

#let C = (
  data: rgb("#ef4444"), enc: rgb("#3b82f6"),
  target: rgb("#14b8a6"), pred: rgb("#f97316"),
  loss: rgb("#dc2626"), hidden: rgb("#6b7280"),
)

#let comp(pos, label, tint: white, w: 26mm, ..args) = node(
  pos, align(center, label), width: w,
  fill: tint.lighten(60%), stroke: 1pt + tint.darken(20%),
  corner-radius: 5pt, ..args,
)

#diagram(
  spacing: (14mm, 12mm),
  edge-stroke: 1pt,
  mark-scale: 70%,

  // Input
  comp((0,0.5), [Input $x$\ #text(size: 7pt, fill: gray)[context patches]], tint: C.data, w: 24mm),

  // Context encoder (online, gradient)
  comp((1,0), [Context\ Encoder\ #text(size: 7pt, fill: gray)[$f_theta$]], tint: C.enc, w: 26mm),

  // Target encoder (EMA, no gradient)
  comp((1,1), [Target\ Encoder\ #text(size: 7pt, fill: gray)[$f_(overline(theta))$ (EMA)]], tint: C.target, w: 26mm),

  // Predictor
  comp((2,0), [Predictor\ #text(size: 7pt, fill: gray)[$g_phi$: predict\ target from context]], tint: C.pred, w: 28mm),

  // Target representation
  comp((2,1), [Target\ Repr\ #text(size: 7pt, fill: gray)[masked patches]], tint: C.target, w: 24mm),

  // Loss
  comp((3,0.5), [$cal(L)_"pred"$\ + $cal(L)_"SIGReg"$], tint: C.loss, w: 22mm),

  // Mask indicator
  node(
    (0.5, 1), align(center, text(size: 8pt)[mask]),
    width: 16mm, fill: C.hidden.lighten(80%),
    stroke: (dash: "dashed", thickness: 0.8pt, paint: C.hidden),
    corner-radius: 3pt,
  ),

  // Edges
  edge((0,0.5), (1,0), "-|>", label: text(size: 7pt)[context]),
  edge((0,0.5), (1,1), "-|>", label: text(size: 7pt)[full], label-side: right),
  edge((1,0), (2,0), "-|>"),
  edge((1,1), (2,1), "-|>", stroke: C.target + 1pt),
  edge((2,0), (3,0.5), "-|>"),
  edge((2,1), (3,0.5), "-|>"),

  // EMA update (dashed, no gradient)
  edge((1,0), (1,1), "-|>",
    stroke: C.hidden + 0.5pt, dash: "dotted",
    label: text(size: 6pt, fill: C.hidden)[EMA],
    label-side: right,
    shift: 6pt),
)
