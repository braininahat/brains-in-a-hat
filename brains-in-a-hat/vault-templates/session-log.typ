// Session Log — {{project}}
// Auto-maintained by Gale (session scribe)
// Path: ~/.brains_in_a_hat/vault/projects/{{project}}/session-log.typ

#import "@local/diagrams:0.1.0": *

#set document(title: "Session Log — {{project}}", date: auto)
#set page(paper: "a4", margin: (x: 25mm, y: 30mm), numbering: "1")
#set text(font: "New Computer Modern", size: 10pt, lang: "en")
#set heading(numbering: "1.1")
#set par(justify: true)
#set figure(supplement: [Fig.])
#set figure.caption(separator: [. ])
#show figure: set block(breakable: false)
#show ref: it => {
  let el = it.element
  if el != none and el.func() == figure { [Fig. #it] } else { it }
}

#show heading.where(level: 1): it => {
  pagebreak(weak: true)
  text(weight: "bold", size: 14pt, it)
  v(0.3em)
}
#show heading.where(level: 2): set text(size: 12pt)
#show link: set text(fill: rgb("#2563eb"))
#show raw.where(block: true): set text(size: 9pt)

// ── Title Page ──────────────────────────────────────────────────────

#align(center)[
  #v(6cm)
  #text(size: 28pt, weight: "bold")[Session Log]
  #v(0.5cm)
  #text(size: 16pt, fill: gray)[{{project}}]
  #v(2cm)
  #text(size: 11pt, fill: gray)[
    Auto-maintained by session scribe \
    Created: {{date}}
  ]
]

#pagebreak()

// ── Table of Contents ───────────────────────────────────────────────

#outline(indent: auto, depth: 2)

#pagebreak()

// ── Sessions ────────────────────────────────────────────────────────
// New session chapters are appended below by the scribe agent.
// Each session is a level-1 heading with ISO timestamp.
// Sections within a session are level-2 headings.
//
// Standard sections (populated as data arrives, empty stubs removed at session end):
//   == Research Questions
//   == Hypotheses
//   == Formulations
//   == Methods
//   == Architecture          ← use fletcher diagrams via ml-diagram()
//   == Inputs
//   == Outputs
//   == Metrics               ← tables, wandb links
//   == Results               ← tables, plots (image()), charts
//   == Interpretation
//   == Related Work
//   == Decisions & Notes
//
// ── Embedding conventions ───────────────────────────────────────────
// Architecture diagrams (inline fletcher):
//   #figure(
//     ml-diagram(
//       data-in((0,0), [Input\ #dim[(T, 22)]]),
//       edge("-|>"),
//       encoder((1,0), [BiGRU\ #dim[(T, 256)]]),
//     ),
//     caption: [Pipeline overview.],
//   ) <fig:label>
//
// External images (screenshots, plots, wandb exports):
//   #figure(
//     image("figures/loss-curve.png", width: 80%),
//     caption: [Training loss over epochs.],
//   ) <fig:loss>
//
// Tables (metrics, comparisons):
//   #figure(
//     table(
//       columns: (auto, 1fr, 1fr),
//       stroke: none,
//       table.hline(stroke: 0.8pt),
//       [*Model*], [*Metric*], [*Value*],
//       table.hline(stroke: 0.4pt),
//       [A], [0.95], [0.87],
//       table.hline(stroke: 0.8pt),
//     ),
//     caption: [Comparison of approaches.],
//   ) <tab:label>
//
// Math (formulations, equations):
//   $ L = -sum_(t=1)^T log p(y_t | x) $
