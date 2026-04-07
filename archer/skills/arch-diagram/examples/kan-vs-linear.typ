// KAN vs Linear Head — interpretability comparison

#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge
#set page(width: auto, height: auto, margin: 5mm, fill: white)
#set text(font: "New Computer Modern", size: 10pt)

#let C = (enc: rgb("#3b82f6"), out: rgb("#22c55e"), embed: rgb("#8b5cf6"))

#let comp(pos, label, tint: white, w: 24mm, ..args) = node(
  pos, align(center, label), width: w,
  fill: tint.lighten(60%), stroke: 1pt + tint.darken(20%),
  corner-radius: 5pt, ..args,
)

#grid(
  columns: 2,
  gutter: 20mm,

  figure(
    diagram(
      spacing: (12mm, 8mm),
      edge-stroke: 1pt,
      mark-scale: 60%,

      comp((0,0), [Seq Output\ #text(size: 7pt, fill: gray)[(T, 256)]], tint: C.enc),
      edge("-|>", label: text(size: 8pt)[$W x + b$]),
      comp((1,0), [Logits\ #text(size: 7pt, fill: gray)[(T, 46)]], tint: C.out),

      // Annotation
      node((0.5, 0.8), text(size: 7pt, fill: gray)[opaque: what did $W$ learn?],
        stroke: none, fill: none),
    ),
    caption: [*Linear*: $W x + b$\ Accurate but opaque],
  ),

  figure(
    diagram(
      spacing: (12mm, 8mm),
      edge-stroke: 1pt,
      mark-scale: 60%,

      comp((0,0), [Seq Output\ #text(size: 7pt, fill: gray)[(T, 256)]], tint: C.enc),
      edge("-|>", label: text(size: 8pt)[$sum phi_(i j)(x_i)$]),
      comp((1,0), [Logits\ #text(size: 7pt, fill: gray)[(T, 46)]], tint: C.embed),

      // Annotation
      node((0.5, 0.8), text(size: 7pt, fill: C.embed)[each $phi_(i j)$: inspectable spline],
        stroke: none, fill: none),
    ),
    caption: [*KAN*: learnable splines $phi_(i j)$\ Same accuracy, *interpretable*],
  ),
)
