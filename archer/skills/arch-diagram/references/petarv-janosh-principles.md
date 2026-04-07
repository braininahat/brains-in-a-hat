# Visual Design Principles

Derived from Petar Velickovic's ML architecture figures and Janosh Riebesell's scientific diagram collection.

## Core Rules

### 1. Mathematical Formalism Inside Diagrams
Place equations and notation *within* or *beside* nodes, not in separate figures. The diagram IS the formulation.

```typst
// Good: equation inside the node
blob((1,0), [$sum sigma(W_i e_i) dot e_i$], tint: orange)

// Bad: generic label with equation elsewhere
blob((1,0), [Fusion Module], tint: orange)
```

### 2. Semantic Color, Not Decorative Color
Every color must encode function. If removing color loses information, the diagram is well-designed. If removing color changes nothing, the color is decorative noise.

### 3. Progressive Complexity
Build diagrams from simple to complex. Start with the high-level data flow (3-5 nodes). Add internal structure only where it clarifies mechanism.

### 4. Whitespace Is Structure
Spacing between components conveys relationships. Tightly coupled components sit close; loosely coupled components have visual separation. Use consistent `spacing` values.

### 5. One Accent Per Diagram
Emphasize ONE architectural innovation by giving it a distinct visual treatment (brighter color, larger node, or annotation). Everything else stays at baseline styling.

### 6. Vector Output Only
Always produce PDF or SVG. Never rasterize architecture diagrams. Font rendering, line crispness, and zoom behavior all depend on vector output.

### 7. Grid Alignment
All nodes should snap to a logical grid. Use fletcher's coordinate system `(col, row)` consistently. Avoid fractional coordinates unless creating deliberate visual grouping (e.g., `(0, 0.5)` to vertically center between two rows).

### 8. Typography
- Node labels: `New Computer Modern` 10pt (matches academic papers)
- Annotations: 7-8pt for secondary information (dimensions, shapes)
- Mathematical notation: standard Typst math mode `$...$`
- No bold except for emphasis on ONE element

## Anti-Patterns

### Don't: Enumerate Lists as Diagrams
Tables or bullet lists in boxes are NOT architecture diagrams. Diagrams show *flow*, *transformation*, and *structure*.

### Don't: Arrows Everywhere
Each edge should represent a data transformation or dependency. Decorative arrows clutter.

### Don't: Rainbow Palette
More than 4-5 colors in a single diagram indicates over-categorization. Group semantically similar components under one color.

### Don't: 3D Effects
Shadows, gradients, and perspective add noise without information. Exception: `cylinder` shape for databases/storage.

## Composition Patterns

### Linear Pipeline
```
Input → Encoder → Seq Model → Head → Output
```
Horizontal flow, left-to-right. Each node at `(col, 0)`.

### Encoder-Decoder
```
Input → Encoder → Latent → Decoder → Output
                    ↕
              (bottleneck)
```
Symmetric layout. Use color transition (blue → purple → teal).

### Multi-Branch Fusion
```
Branch A → ┐
            ├→ Fusion → Output
Branch B → ┘
```
Branches at different rows, fusion at center. Use `enclose` for grouping.

### Residual / Skip Connection
```
Input → Layer → Output
  └─────────────→┘
```
Use edge routing: `edge((0,0), "r,dd,r", "-|>", stroke: gray + 0.5pt)`.

### Parallel Comparison
Two diagrams side-by-side using `grid(columns: 2, ...)`. Same spatial layout, different components. Highlights what changed.
