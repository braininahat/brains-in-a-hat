---
name: figure-compose
description: This skill should be used when the user asks to "combine figures", "make a figure panel", "arrange subfigures", "create a composite figure", or needs to lay out multiple SVGs/PDFs into a grid for a paper figure.
---

# Multi-Panel Figure Composition

Lay out multiple SVGs or Typst sub-diagrams into a grid using Typst's `#grid()`. Produces a single numbered figure with subfigure labels (a), (b), (c)...

## Two-Panel Grid (most common)

```typst
#figure(
  grid(
    columns: 2,
    gutter: 8mm,
    [
      #image("figures/early-fusion.svg", width: 100%)
      #align(center)[*(a)* Early fusion]
    ],
    [
      #image("figures/late-fusion.svg", width: 100%)
      #align(center)[*(b)* Late fusion]
    ],
  ),
  caption: [Fusion strategies. *(a)* Early fusion concatenates modalities at the input. *(b)* Late fusion combines predictions at the output.],
) <fig:fusion>
```

## Three-Panel Grid

```typst
#figure(
  grid(
    columns: 3,
    gutter: 6mm,
    [#image("figures/arch-bigru.svg") #align(center)[*(a)*]],
    [#image("figures/arch-bimamba.svg") #align(center)[*(b)*]],
    [#image("figures/arch-transformer.svg") #align(center)[*(c)*]],
  ),
  caption: [Encoder architectures: *(a)* BiGRU, *(b)* BiMamba (causal), *(c)* Transformer.],
) <fig:encoders>
```

## Mixed: fletcher + SVG Side by Side

```typst
#figure(
  grid(
    columns: 2,
    gutter: 10mm,
    align: horizon,
    figure(
      ml-diagram(
        data-in((0,0), [Input]),
        edge("-|>"),
        encoder((1,0), [Encoder]),
        edge("-|>"),
        ctc-head((2,0), [CTC]),
      ),
      caption: none,
    ),
    image("figures/ctc-trellis.svg", width: 100%),
  ),
  caption: [*(a)* CTC pipeline (left) and *(b)* CTC trellis lattice (right).],
) <fig:ctc>
```

## Asymmetric Columns

For panels with different natural widths, use fractional units:

```typst
grid(
  columns: (2fr, 1fr),    // left panel is twice as wide
  gutter: 8mm,
  image("figures/wide-arch.svg"),
  image("figures/detail.svg"),
)
```

## Subfigure Label Styles

Preferred: bold `*(a)*` inline below each panel.

Alternative for formal publications (no separate subfigure support in Typst):

```typst
#let subfig(body, label) = stack(
  body,
  v(2mm),
  align(center, text(8pt)[#label]),
)

#subfig(image("figures/a.svg"), "(a) Early fusion")
```

## Gutter Guidelines

| Layout | Gutter |
|--------|--------|
| 2-column tight | 6mm |
| 2-column standard | 8–10mm |
| 3-column | 5–6mm |
| Mixed types (diagram + SVG) | 10–12mm |

## Caption Writing Rules

1. Mention all panels by label: "*(a)* ..., *(b)* ..."
2. State what the reader should conclude, not just what is shown
3. Keep under 2 sentences; details go in the body text
