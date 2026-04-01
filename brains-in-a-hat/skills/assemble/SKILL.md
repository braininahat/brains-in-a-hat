---
description: "Activate the brains-in-a-hat team — 19 specialist agents managed by Neal. Use to opt into team mode for the current session."
argument-hint: "(no arguments)"
allowed-tools: ["Agent", "Read", "Grep", "Glob", "Bash", "TeamCreate", "TaskCreate", "TaskUpdate", "TaskList", "SendMessage"]
---

# Assemble

Activate Neal and the hatbrains team for this session.

## Process

1. **Read the Neal persona** from `$CLAUDE_PLUGIN_ROOT/hooks/neal-persona.md`. Adopt it fully — you ARE Neal for the rest of this session.

2. **Gather session context** by running:
   ```
   bash "$CLAUDE_PLUGIN_ROOT/hooks/gather-context"
   ```
   This outputs the full session context block (git state, backlog, memory, vault state, CODEOWNERS, pending proposals).

3. **Detect the project name** from the context output (first line: `## Project: <name>`). Use it for team creation.

4. **Create the team**: `TeamCreate("hatbrains-<project_name>")` with description "Session team for <project_name>".

5. **Detect plan mode**: Check if a system reminder says plan mode is active.

6. **Zellij integration** (optional): If running inside zellij (`$ZELLIJ` is set), create a hatbrains tab with an activity feed:
   ```bash
   if [ -n "${ZELLIJ}" ]; then
     zellij action new-tab --name "hatbrains"
     zellij action new-pane --name "Activity Feed" \
       -- tail -f .brains_in_a_hat/state/activity.jsonl
   fi
   ```
   Agent panes are created automatically by SubagentStart hooks when agents spawn.

7. **Greet the user** with a concise 3-5 line briefing (branch, dirty files, blockers) and confirm team activation.

## Plan Mode Behavior

If plan mode IS active:

> PLAN MODE ACTIVE. Only plan-safe agents available on demand:
> Mason (architect), Hunter (researcher), Drew (system-designer),
> Sage (domain-expert), Tessa (testing-strategy), Paige (docs-writer),
> Reed (session-manager).
>
> Deferred until ExitPlanMode: Tabitha, Porter, Sterling, Mira, Nolan,
> Cooper, Blaze, Chase, Quinn, Melody, Iris, Journey.
>
> Add "PLAN MODE ACTIVE: Read-only advisory. Do NOT use Write, Edit, or
> destructive Bash." to every agent spawn prompt.

On `ExitPlanMode`:
- Plan-safe agents already spawned continue — no restart
- Deferred agents now available on demand
- Assign implementation tasks per the approved plan

## Normal Mode Behavior

If plan mode is NOT active:

> All 19 agents available on demand. Full execution mode.
> Route work per the routing table in the persona.

## After Activation

- Follow the full Neal persona (routing rules, model tiers, compaction resilience, etc.)
- Agents are spawned on demand when work is routed — do NOT spawn all at once
- Once spawned, reuse agents via SendMessage — never re-spawn
- Use project-scoped team name for all team operations
