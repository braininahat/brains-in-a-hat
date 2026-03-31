---
description: "Run a post-task retrospective — evaluates what went well, what was missed, proposes improvements. Use after completing a major task or feature."
argument-hint: "(no arguments)"
allowed-tools: ["Agent", "Read", "Write", "Grep", "Glob"]
---

# Team Retrospective

Spawn the `meta-retro` agent to run a post-task retrospective.

## Process

1. Spawn `meta-retro` agent (model=sonnet, run_in_background=true)
2. It reviews: what went well, what was missed, specialist effectiveness
3. Proposes prompt/checklist updates for underperforming specialists
4. Checks for new unowned paths (CODEOWNERS update)
5. Writes retrospective to `.claude/team/last-retro.md` and vault
6. Returns summary to Neal
