---
name: team-debrief
description: "Save session state — decisions made, WIP items, workflow preferences. Writes to vault and local state."
allowed-tools: ["Agent", "Read", "Write", "Grep", "Glob", "Bash"]
---

# Team Debrief

Spawn the `session-manager` agent in debrief mode to persist session state.

## Process

1. Spawn `session-manager` agent (model=sonnet, run_in_background=true)
2. It reviews what was accomplished this session
3. Persists to `.brains_in_a_hat/state/last-retro.md` (always)
4. Persists to `~/.brains_in_a_hat/vault/projects/<project>/` (if vault exists)
5. Updates user preferences if new workflow patterns were observed
