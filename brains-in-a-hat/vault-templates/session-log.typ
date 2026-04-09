// Session Log — {{project}}
// Auto-maintained by Gale (session scribe)
// Path: ~/.brains_in_a_hat/vault/projects/{{project}}/session-log.typ

#set document(title: "Session Log — {{project}}", date: auto)
#set page(paper: "a4", margin: (x: 2cm, y: 2.5cm), numbering: "1")
#set text(font: "New Computer Modern", size: 11pt)
#set heading(numbering: "1.1")
#set par(justify: true)

#show heading.where(level: 1): it => {
  pagebreak(weak: true)
  set text(size: 16pt, weight: "bold")
  it
}
#show heading.where(level: 2): set text(size: 13pt)
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
//   == Architecture
//   == Inputs
//   == Outputs
//   == Metrics
//   == Results
//   == Interpretation
//   == Related Work
//   == Decisions & Notes
