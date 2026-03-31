---
description: "Get a session briefing — branch status, uncommitted changes, open issues, last session context. Use at session start or when asking 'what's the status?'"
argument-hint: "(no arguments)"
allowed-tools: ["Agent", "Read", "Grep", "Glob", "Bash"]
---

# Team Briefing

Spawn the `session-manager` agent to produce a session briefing.

## Process

1. Spawn `session-manager` agent (model=sonnet, run_in_background=true)
2. It reads git status, open issues, CODEOWNERS, and prior session state
3. Returns a concise briefing (under 20 lines)
4. Present the briefing to the user

## Plan Mode

If plan mode is active, append to the briefing:

> **Plan mode active** — read-only advisory mode. Plan-safe agents available on demand:
> Mason, Hunter, Drew, Sage, Tessa, Paige, Reed
>
> Deferred until plan mode exits: Tabitha, Porter, Sterling, Mira, Nolan, Cooper, Blaze, Chase, Quinn, Melody, Iris, Journey
