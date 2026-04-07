// typst-diagrams component library
// Import in any report: #import "/home/varun/.claude/skills/typst-diagrams/lib.typ": *

#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge
#import fletcher.shapes: house, hexagon, diamond, pill, cylinder

// ── Semantic Color Palette ──────────────────────────────────────────

#let C = (
  data:    rgb("#ef4444"),  // input data, observations
  enc:     rgb("#3b82f6"),  // encoder, processing
  dec:     rgb("#14b8a6"),  // decoder, generation
  attn:    rgb("#f97316"),  // attention, gating
  norm:    rgb("#eab308"),  // normalization, regularization
  out:     rgb("#22c55e"),  // output, prediction
  embed:   rgb("#8b5cf6"),  // embedding, latent
  hidden:  rgb("#6b7280"),  // intermediate, auxiliary
  loss:    rgb("#dc2626"),  // loss, error signal
)

// ── Base Component ──────────────────────────────────────────────────

#let comp(pos, label, tint: white, w: 26mm, ..args) = node(
  pos, align(center, label), width: w,
  fill: tint.lighten(60%),
  stroke: 1pt + tint.darken(20%),
  corner-radius: 5pt,
  ..args,
)

// ── Data Nodes ──────────────────────────────────────────────────────

#let data-in(pos, label, ..a) = comp(
  pos, label, tint: C.data, shape: house.with(angle: 30deg), w: auto, ..a)

#let data-out(pos, label, ..a) = comp(
  pos, label, tint: C.out, shape: pill, w: 22mm, ..a)

// ── Encoder / Decoder ───────────────────────────────────────────────

#let encoder(pos, label, ..a) = comp(pos, label, tint: C.enc, ..a)
#let decoder(pos, label, ..a) = comp(pos, label, tint: C.dec, ..a)
#let frame-enc(pos, label, ..a) = comp(pos, label, tint: C.enc, w: 30mm, ..a)
#let seq-enc(pos, label, ..a) = comp(pos, label, tint: C.enc, w: 32mm, ..a)

// ── Attention / Gating ──────────────────────────────────────────────

#let attention(pos, label, ..a) = comp(
  pos, label, tint: C.attn, shape: hexagon, ..a)

#let gated-fusion(pos, label, ..a) = comp(
  pos, label, tint: C.attn, shape: hexagon, ..a)

#let multi-head(pos, label, ..a) = comp(
  pos, label, tint: C.attn, w: 34mm, ..a)

// ── Normalization ───────────────────────────────────────────────────

#let norm-node(pos, label, ..a) = comp(
  pos, label, tint: C.norm, shape: hexagon, w: 22mm, ..a)

#let mask-node(pos, label, ..a) = node(
  pos, align(center, label), width: 24mm,
  fill: C.hidden.lighten(80%),
  stroke: (dash: "dashed", thickness: 1pt, paint: C.hidden),
  corner-radius: 5pt, ..a,
)

// ── Heads / Output ──────────────────────────────────────────────────

#let ctc-head(pos, label, ..a) = comp(pos, label, tint: C.out, ..a)
#let linear-head(pos, label, ..a) = comp(pos, label, tint: C.enc, w: 22mm, ..a)
#let kan-head(pos, label, ..a) = comp(pos, label, tint: C.embed, ..a)

// ── Embedding / Latent ──────────────────────────────────────────────

#let embedding(pos, label, ..a) = comp(pos, label, tint: C.embed, ..a)
#let latent(pos, label, ..a) = comp(pos, label, tint: C.embed, shape: pill, w: 20mm, ..a)

// ── Loss ────────────────────────────────────────────────────────────

#let loss-node(pos, label, ..a) = comp(
  pos, label, tint: C.loss, shape: diamond, w: 22mm, ..a)

// ── Structural ──────────────────────────────────────────────────────

#let storage(pos, label, ..a) = comp(
  pos, label, tint: C.hidden, shape: cylinder, w: 24mm, ..a)

// ── Annotation helpers ──────────────────────────────────────────────

#let dim(body) = text(size: 7pt, fill: gray, body)
#let math-label(body) = text(size: 8pt, body)

// ── Diagram presets ─────────────────────────────────────────────────

#let ml-diagram(..args) = diagram(
  spacing: (12mm, 10mm),
  edge-stroke: 1pt,
  edge-corner-radius: 5pt,
  mark-scale: 70%,
  ..args,
)

// ── Edge helpers ────────────────────────────────────────────────────

#let skip-edge(from, to, ..a) = edge(
  from, to, "-|>",
  stroke: C.hidden + 0.5pt, dash: "dashed", ..a)

#let loss-edge(from, to, ..a) = edge(
  from, to, "-|>",
  stroke: C.loss + 0.8pt, dash: "dashed", ..a)

// ── Additional components (from review) ────────────────────────────

#let pool(pos, label, ..a) = comp(
  pos, label, tint: C.enc, shape: hexagon, w: 20mm, ..a)

#let sample(pos, label, ..a) = comp(
  pos, label, tint: C.hidden, shape: diamond, w: 22mm, ..a)

#let cond-edge(from, to, ..a) = edge(
  from, to, "-|>",
  stroke: C.attn + 1pt, dash: "dotted", ..a)

#let recurse-edge(from, to, ..a) = edge(
  from, to, "-|>",
  stroke: C.hidden + 0.5pt, bend: 60deg, ..a)

// ── System design components ───────────────────────────────────────

#let service(pos, label, ..a) = comp(pos, label, tint: C.enc, ..a)
#let database(pos, label, ..a) = comp(pos, label, tint: C.hidden, shape: cylinder, w: 24mm, ..a)
#let queue(pos, label, ..a) = comp(pos, label, tint: C.attn, shape: parallelogram, ..a)
#let client(pos, label, ..a) = comp(pos, label, tint: C.data, shape: house.with(angle: 30deg), w: auto, ..a)
#let cache-node(pos, label, ..a) = comp(pos, label, tint: C.norm, shape: hexagon, w: 22mm, ..a)
#let balancer(pos, label, ..a) = comp(pos, label, tint: C.dec, shape: diamond, w: 22mm, ..a)

// ── TikZ SVG bridge ────────────────────────────────────────────────
// NOTE: #image() resolves relative to the calling file, not lib.typ.
// Pattern for reports:
//   #figure(image("figures/arch.svg", width: 90%), caption: [...])
