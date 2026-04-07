// Tensor Dimension Visualization — 2D proportional blocks
// Width encodes feature dimension, height is constant (temporal axis)

#import "@local/diagrams:0.1.0": *
#set page(width: auto, height: auto, margin: 8mm, fill: white)
#set text(font: "New Computer Modern", size: 10pt)

// Proportional block: width scales with feature dimension
#let tensor(pos, label, feat-dim, tint: C.data, max-w: 80mm) = {
  let w = calc.max(8mm, feat-dim / 883 * max-w)
  comp(pos, label, tint: tint, w: w)
}

#diagram(
  spacing: (16mm, 14mm),
  edge-stroke: 1pt,
  mark-scale: 70%,

  // ── Ultrasound path (row 0) ──
  tensor((0,0), [Ultrasound\ #dim[$(T, 487 times 883)$]], 883, tint: C.data),
  edge("-|>", label: dim[ResNet18]),
  tensor((1,0), [Spatial\ Features\ #dim[$(T, 256)$]], 256, tint: C.enc),
  edge("-|>", label: dim[BiGRU]),
  tensor((2,0), [Seq\ Output\ #dim[$(T, 256)$]], 256, tint: C.enc),
  edge("-|>", label: dim[Linear]),
  tensor((3,0), [CTC\ Logits\ #dim[$(T, 46)$]], 46, tint: C.out),

  // ── Pose path (row 1) ──
  tensor((0,1), [Poses\ #dim[$(T, 22)$\ mm-space]], 22, tint: C.attn),
  edge("-|>", label: dim[CNN1D]),
  tensor((1,1), [Frame\ Features\ #dim[$(T, 256)$]], 256, tint: C.enc),

  // ── Audio path (row 2) ──
  tensor((0,2), [Mel Spec\ #dim[$(T, 80)$\ 50fps]], 80, tint: C.embed),
  edge("-|>", label: dim[CNN1D]),
  tensor((1,2), [Audio\ Features\ #dim[$(T, 256)$]], 256, tint: C.enc),

  // Fusion
  gated-fusion((2,1), [Gated\ Fusion\ #dim[$sum sigma(W e) dot e$]], w: 28mm),
  edge((1,1), (2,1), "-|>"),
  edge((1,2), (2,1), "-|>"),
  edge((2,1), (2,0), "-|>", label: dim[transfer], label-side: right),
)
