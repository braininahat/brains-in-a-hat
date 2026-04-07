# Fletcher API Quick Reference

Package: `@preview/fletcher:0.5.8` (built on `cetz:0.3.4`)

## Import
```typst
#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge
#import fletcher.shapes: house, hexagon, diamond, pill, parallelogram, trapezium, chevron, octagon, cylinder
```

## diagram()
```typst
#diagram(
  spacing: (12mm, 10mm),     // (col-gap, row-gap)
  cell-size: (8mm, 10mm),    // minimum cell dimensions
  edge-stroke: 1pt,          // default edge thickness
  edge-corner-radius: 5pt,   // smooth bends
  mark-scale: 70%,           // arrowhead size
  node-stroke: 0.5pt,        // default node border
  axes: (ltr, ttb),          // left-to-right, top-to-bottom
  // ... nodes and edges as positional args
)
```

## node()
```typst
node(
  (col, row),               // position in grid
  [Label content],          // Typst content
  width: 28mm,              // explicit width
  height: auto,             // auto-fit to content
  fill: blue.lighten(60%),  // background
  stroke: 1pt + blue,       // border
  corner-radius: 5pt,       // rounded corners
  shape: rect,              // rect | circle | hexagon | house | pill | diamond | ...
  name: <node-id>,          // for referencing in edges
  enclose: ((0,0), (1,0)),  // enlarge to contain other nodes
  layer: 1,                 // drawing order (higher = on top)
  extrude: (0, -3),         // multi-stroke effect
)
```

## edge()
```typst
edge(
  (0,0), (1,0),             // from, to (or chain of vertices)
  "-|>",                    // marks shorthand
  label: [text],            // label content
  label-pos: 50%,           // position along edge (0-100%)
  label-side: left,         // left | right | center
  stroke: 1pt + gray,       // edge style
  dash: "dashed",           // "dashed" | "dotted" | "dash-dotted"
  bend: 30deg,              // curve amount
  decorations: "wave",      // "wave" | "zigzag" | "coil"
  corner: "round",          // "round" | "sharp"
  crossing: true,           // gap when crossing other edges
  shift: 3pt,               // lateral offset
)
```

## Edge Routing Shorthand
Directional strings for complex paths:
- `"r"` = right, `"l"` = left, `"u"` = up, `"d"` = down
- `"rr"` = right x2, `"uu"` = up x2
- Comma-separated: `"l,uu,r"` = left, up twice, right (residual connection)
- `"r,d,r"` = right, down, right (skip around a block)

## Arrow Marks
| Shorthand | Meaning |
|-----------|---------|
| `"->"` | Standard arrow |
| `"-|>"` | Triangle arrow |
| `"--|>"` | Double-line triangle |
| `"<->"` | Bidirectional |
| `"=>"` | Double-line arrow |
| `"hook->"` | Hook start |
| `"->>"` | Double head |

## Available Shapes (16)
`rect`, `circle`, `ellipse`, `pill`, `diamond`, `hexagon`, `octagon`, `parallelogram`, `trapezium`, `house`, `chevron`, `triangle`, `cylinder`, `brace`, `bracket`, `paren`

Shapes accept `.with()` for customization:
```typst
shape: house.with(angle: 30deg)
shape: hexagon.with(angle: 30deg)
```

## Reusable Node Pattern
```typst
#let blob(pos, label, tint: white, ..args) = node(
  pos, align(center, label),
  width: 28mm,
  fill: tint.lighten(60%),
  stroke: 1pt + tint.darken(20%),
  corner-radius: 5pt,
  ..args,
)
```

## Grid Layout for Side-by-Side Diagrams
```typst
#figure(
  grid(columns: 2, gutter: 12mm,
    diagram(/* left */),
    diagram(/* right */),
  ),
  caption: [Left: X. Right: Y.],
)
```
