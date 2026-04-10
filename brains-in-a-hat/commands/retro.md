---
name: retro
description: "Manual mid-task retrospective. Auto-fires on PreCompact (checkpoint) + SessionEnd (final); use this only if you want an on-demand mid-session checkpoint."
allowed-tools: ["Agent", "Read", "Write", "Grep", "Glob"]
---

# Retro

Spawn Mira (meta-retro) for an on-demand retrospective.

## Automation

Retros auto-fire in two places — you do NOT need to run this command in normal flow:

- **PreCompact** → writes `retro-pending.<sid>="checkpoint"` → post-compact `first-prompt-greeting` instructs Neal to spawn Mira in `mode=checkpoint` on the next prompt.
- **SessionEnd** → `additionalContext` instructs Neal to spawn Mira in `mode=final` in parallel with Reed (persist) and Gale-finalize.

This manual command is an **escape hatch** for on-demand mid-task retrospectives (e.g., "Mira, what patterns have we seen so far in this task?").

## Process

1. Spawn `Agent(subagent_type="brains-in-a-hat:meta-retro", name="Mira", model="sonnet", run_in_background=true, prompt="mode=checkpoint. Read session-state.json, activity.jsonl, and the current session-log in vault. Write a condensed retrospective. Report a one-line receipt.")`.
2. Mira runs in background. When she finishes, relay her one-line receipt to the user.
3. Do NOT wait for her — continue any in-flight work.
