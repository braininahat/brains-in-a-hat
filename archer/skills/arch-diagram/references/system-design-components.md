# System Design Components

Extend the ML component library for system architecture diagrams. Same fletcher approach, semantic colors.

## Additional Components for lib.typ

```typst
// ── System Design ───────────────────────────────────────────────────

#let service(pos, label, ..a) = comp(pos, label, tint: C.enc, ..a)
#let database(pos, label, ..a) = comp(pos, label, tint: C.hidden, shape: cylinder, w: 24mm, ..a)
#let queue(pos, label, ..a) = comp(pos, label, tint: C.attn, shape: parallelogram, ..a)
#let client(pos, label, ..a) = comp(pos, label, tint: C.data, shape: house.with(angle: 30deg), w: auto, ..a)
#let cache-node(pos, label, ..a) = comp(pos, label, tint: C.norm, shape: hexagon, w: 22mm, ..a)
#let balancer(pos, label, ..a) = comp(pos, label, tint: C.dec, shape: diamond, w: 22mm, ..a)
```

## Semantic Colors for System Design

| Component | Color | Rationale |
|-----------|-------|-----------|
| Service/API | blue (enc) | Processing logic |
| Database | gray (hidden) | Persistent storage |
| Queue/Stream | orange (attn) | Selective routing |
| Client/User | red (data) | Data source |
| Cache | yellow (norm) | Temporary optimization layer |
| Load Balancer | teal (dec) | Distribution/fan-out |
| Storage (blob) | gray (hidden) | Same as database |

## Example: Microservice Architecture

```typst
#import "@local/diagrams:0.1.0": *

#ml-diagram(
  client((0,0), [Mobile App]),
  edge("-|>"),
  balancer((1,0), [API\ Gateway], w: 24mm),
  edge("-|>"),
  service((2,0), [Auth\ Service]),
  edge("-|>"),
  database((3,0), [PostgreSQL]),

  service((2,1), [ML\ Service]),
  queue((1,1), [Kafka], w: 20mm),

  edge((1,0), (2,1), "-|>"),
  edge((1,0), (1,1), "-|>"),
  edge((1,1), (2,1), "-|>"),
)
```

## Example: Data Pipeline

```typst
#ml-diagram(
  storage((0,0), [S3 Raw\ Data]),
  edge("-|>"),
  service((1,0), [ETL\ Worker]),
  edge("-|>"),
  database((2,0), [Feature\ Store]),
  edge("-|>"),
  service((3,0), [Training\ Job]),
  edge("-|>"),
  storage((4,0), [Model\ Registry]),
)
```
