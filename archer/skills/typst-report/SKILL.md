---
name: typst-report
description: This skill should be used when the user asks to "create a report", "write a Typst report", "generate a research report", "make a PDF report", or needs a full document with mixed diagram types (fletcher + TikZ SVG). Provides report templates and the @local/diagrams integration pattern.
---

# Typst Research Report

Create full Typst documents that mix fletcher architecture diagrams (via `@local/diagrams:0.1.0`) with TikZ-rendered SVGs (via `#image()`). Output is a single PDF with numbered figures, cross-references, and publication-ready typography.

## Standard Preamble

Every report begins with this template:

```typst
#import "@local/diagrams:0.1.0": *

#set page(
  paper: "a4",
  margin: (x: 25mm, y: 30mm),
)
#set text(font: "New Computer Modern", size: 10pt, lang: "en")
#set heading(numbering: "1.1")
#set figure(supplement: [Fig.])
#set figure.caption(separator: [. ])
#show figure: set block(breakable: false)
#show ref: it => {
  let el = it.element
  if el != none and el.func() == figure { [Fig. #it] } else { it }
}

#show heading.where(level: 1): it => {
  v(1em)
  text(weight: "bold", size: 12pt, it)
  v(0.3em)
}
```

## Title Block

```typst
#align(center)[
  #text(size: 14pt, weight: "bold")[Report Title]
  #v(0.3em)
  #text(size: 10pt, fill: gray)[Author · Date · Version]
]
#v(1em)
#line(length: 100%, stroke: 0.5pt + gray)
#v(1em)
```

## Figure Numbering and Cross-References

All figures are numbered automatically. Reference them with `@label`:

```typst
#figure(
  ml-diagram(
    data-in((0,0), [Input]),
    edge("-|>"),
    encoder((1,0), [Encoder]),
  ),
  caption: [CTC pipeline overview. Input poses are encoded before CTC decoding.],
) <fig:pipeline>

As shown in @fig:pipeline, the encoder receives raw pose sequences.
```

## Mixed Diagram Pattern: fletcher + TikZ SVG

The core pattern for combining both diagram types in one report:

```typst
// Fletcher diagram (inline — uses @local/diagrams)
#figure(
  ml-diagram(
    data-in((0,0), [Poses\ #dim[(T, 22)]]),
    edge("-|>"),
    encoder((1,0), [BiGRU\ #dim[(T, 256)]]),
    edge("-|>"),
    ctc-head((2,0), [CTC\ #dim[46]]),
    edge("-|>"),
    data-out((3,0), [Phonemes]),
  ),
  caption: [Recognition pipeline (fletcher).],
) <fig:arch>

// TikZ SVG (pre-rendered, import as image)
#figure(
  image("figures/bigru-internals.svg", width: 80%),
  caption: [BiGRU cell internals (TikZ).],
) <fig:bigru>
```

**Rule**: Use fletcher for data flow and pipeline diagrams. Use TikZ SVG for internal cell structure, dimensional diagrams, and any figure that requires precise geometric control.

## Section Template

```typst
= Introduction

Brief motivation. @fig:arch shows the overall architecture.

= Methods

== Data

== Model

= Results

#figure(
  image("figures/per-comparison.svg", width: 90%),
  caption: [PER comparison across encoder types. Bootstrap 95% CIs from 1000 samples.],
) <fig:results>

= Discussion

= Conclusion
```

## Table Template

```typst
#figure(
  table(
    columns: (auto, 1fr, 1fr, auto),
    align: (left, center, center, left),
    stroke: none,
    table.hline(stroke: 0.8pt),
    [*Encoder*], [*PER (%)*], [*95% CI*], [*Causal*],
    table.hline(stroke: 0.4pt),
    [BiGRU],    [24.5], [[20.0, 29.6]], [No],
    [BiMamba],  [34.9], [[30.9, 39.3]], [Yes],
    table.hline(stroke: 0.8pt),
  ),
  caption: [Encoder comparison on UXTD official splits.],
) <tab:encoders>
```

## Compilation

```bash
typst compile report.typ report.pdf
# or via arch-diagram's script:
skills/arch-diagram/scripts/compile-diagram.sh report.typ --format pdf
```

Ensure `@local/diagrams:0.1.0` is installed before compiling:
```bash
ls ~/.local/share/typst/packages/local/diagrams/0.1.0/
# should list: lib.typ
```

## Dependencies

- `typst-cli`: `cargo install typst-cli`
- `@local/diagrams:0.1.0`: symlinked from `skills/arch-diagram/lib.typ`
- `New Computer Modern` font: bundled with typst-cli

## Common Pitfalls

| Issue | Fix |
|-------|-----|
| `package not found: @local/diagrams:0.1.0` | `mkdir -p ~/.local/share/typst/packages/local/diagrams/0.1.0 && cp skills/arch-diagram/lib.typ ~/.local/share/typst/packages/local/diagrams/0.1.0/` |
| Figure breaks across pages | `#show figure: set block(breakable: false)` |
| SVG not scaling correctly | Use `width: X%` inside `#image()` |
| References show raw label | Ensure `#set figure(supplement: ...)` and `#show ref:` block are in preamble |
