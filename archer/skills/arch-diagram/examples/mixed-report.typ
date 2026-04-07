// Mixed Report Example — fletcher diagrams + TikZ SVG imports
// Demonstrates both diagram types in a single Typst document.

#import "@local/diagrams:0.1.0": *
#set page(margin: 2cm, numbering: "1")
#set text(font: "New Computer Modern", size: 10pt)
#set par(justify: true)
#set heading(numbering: "1.")

= PULSE Architecture Overview

== Pipeline (Fletcher — inline)

#figure(
  ml-diagram(
    data-in((0,0), [Ultrasound\ #dim[(T, 487, 883)]]),
    edge("-|>"),
    frame-enc((1,0), [ResNet18\ #dim[spatial enc]]),
    edge("-|>"),
    seq-enc((2,0), [BiGRU\ #dim[(T, 256)]]),
    edge("-|>"),
    ctc-head((3,0), [CTC\ #dim[46 classes]]),
    edge("-|>"),
    data-out((4,0), [Phonemes]),

    // Loss
    loss-node((3,1), [$cal(L)_"CTC"$]),
    loss-edge((3,0), (3,1)),
  ),
  caption: [High-level CTC pipeline (architectural flow).],
)

== Tensor Dimensions (TikZ — imported SVG)

The architectural diagram above shows the flow but not the *shape* of data through the pipeline. The dimensional visualization below shows how a $(T, 487, 883)$ ultrasound volume is progressively reduced to $(T, 46)$ logits.

// TikZ SVGs are imported directly — #image() resolves relative to THIS file
#figure(
  image("tensor-shapes.svg", width: 95%),
  caption: [Tensor dimensions through the PULSE pipeline. 3D blocks show (T, H, W) shapes. Note the dramatic spatial reduction from 487$times$883 to 256 channels.],
)

== Multimodal Fusion (Fletcher — comparison)

#figure(
  grid(columns: 2, gutter: 12mm,
    diagram(
      spacing: (8mm, 8mm), edge-stroke: 1pt, mark-scale: 60%,
      encoder((0,0), [Pose\ #dim[(T, 256)]], w: 20mm),
      encoder((0,1), [Audio\ #dim[(T, 256)]], tint: C.attn, w: 20mm),
      gated-fusion((1,0.5), [Gated\ Fusion], w: 20mm),
      ctc-head((2,0.5), [CTC], w: 18mm),
      edge((0,0), (1,0.5), "-|>"),
      edge((0,1), (1,0.5), "-|>"),
      edge((1,0.5), (2,0.5), "-|>"),
    ),
    diagram(
      spacing: (8mm, 8mm), edge-stroke: 1pt, mark-scale: 60%,
      encoder((0,0), [Pose], w: 18mm),
      ctc-head((1,0), [CTC#sub[p]], w: 16mm),
      encoder((0,1), [Audio], tint: C.attn, w: 18mm),
      ctc-head((1,1), [CTC#sub[a]], w: 16mm),
      embedding((2,0.5), [$product$ Fuse], w: 18mm),
      edge((0,0), (1,0), "-|>"),
      edge((0,1), (1,1), "-|>"),
      edge((1,0), (2,0.5), "-|>"),
      edge((1,1), (2,0.5), "-|>"),
    ),
  ),
  caption: [Left: early fusion (single CTC on fused embeddings). Right: late fusion (separate CTC models, predictions combined).],
)
