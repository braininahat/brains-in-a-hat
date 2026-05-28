---
name: review
description: "Review the current diff via Critic with multiple lenses. Advisory only — never blocks."
allowed-tools: ["Agent", "SendMessage", "Read", "Grep", "Glob", "Bash"]
---

# Review

Manual pre-commit review. Spawns Critic with all five lenses and presents the findings.

## Process

1. Capture the diff: `git diff --cached` (or `git diff` if nothing is staged).
2. Spawn / SendMessage Critic with `lens=architecture,security,performance,ux,correctness` and the diff as context.
3. Critic returns findings sectioned by lens; pass them back to the user verbatim.
4. The user decides whether to address any of them before committing.

## Lens narrowing

If the user wants a focused review, they can pass a single lens:
`/review architecture` or `/review security` etc. Default is all five.

## Not lifecycle-automated

This is a manual escape hatch. The system does not auto-fire `/review` — the user calls it when ready. Critic's findings are advisory; nothing is blocking.
