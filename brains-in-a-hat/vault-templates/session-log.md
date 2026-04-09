---
type: session-log
project: "{{project}}"
date: "{{date}}"
tags: [session-log]
status: active
---
# Session Log — {{project}}

> Auto-maintained by Gale (session scribe). Created: {{date}}.

<!-- Session chapters appended below. Each session is a level-1 heading with timestamp. -->
<!-- Sections within a session are level-2 headings. -->
<!--
Standard sections (populated as data arrives, empty stubs removed at session end):
  ## Research Questions
  ## Hypotheses
  ## Formulations
  ## Methods
  ## Architecture        ← ```typst blocks with fletcher diagrams
  ## Inputs
  ## Outputs
  ## Metrics             ← markdown tables, wandb links
  ## Results             ← markdown tables, plots, charts
  ## Interpretation
  ## Related Work
  ## Decisions & Notes

Embedding conventions:
  Architecture diagrams — ```typst fenced blocks (rendered by Obsidian community plugin):
    ```typst
    #import "@local/diagrams:0.1.0": *
    #ml-diagram(
      data-in((0,0), [Input]),
      edge("-|>"),
      encoder((1,0), [BiGRU]),
    )
    ```

  Images — Obsidian embed:
    ![[attachments/loss-curve.png]]

  Math — LaTeX (Obsidian MathJax):
    Inline: $L = -\sum_{t=1}^T \log p(y_t | x)$
    Display: $$\mathcal{L}_\text{CTC} = -\log \sum_{\pi \in \mathcal{B}^{-1}(y)} \prod_{t=1}^T p(\pi_t | x)$$

  Tables — markdown:
    | Model | PER (%) | 95% CI |
    |-------|---------|--------|
    | BiGRU | 24.5    | [20.0, 29.6] |

  wandb links — markdown:
    [Run abc123](https://wandb.ai/team/project/runs/abc123) — lr=1e-3, BiGRU, 50 epochs
-->
