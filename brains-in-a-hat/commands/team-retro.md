---
name: team-retro
description: "Run a post-task retrospective — evaluates what went well, what was missed, proposes improvements."
allowed-tools: ["Agent", "Read", "Write", "Grep", "Glob"]
---

# Team Retrospective

Spawn the `meta-retro` agent to run a post-task retrospective.

## Process

1. Spawn `meta-retro` agent (model=sonnet, run_in_background=true)
2. It reviews: what went well, what was missed, specialist effectiveness
3. Proposes prompt/checklist updates for underperforming specialists
4. Checks for new unowned paths (CODEOWNERS update)
5. Writes retrospective to `.brains_in_a_hat/state/last-retro.md` and vault
6. Returns summary to Neal
