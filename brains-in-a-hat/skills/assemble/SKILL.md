---
description: "Activate the brains-in-a-hat team — 20 specialist agents managed by Neal. Use to opt into team mode for the current session."
argument-hint: "(no arguments)"
allowed-tools: ["Agent", "Read", "Grep", "Glob", "Bash", "TeamCreate", "TaskCreate", "TaskUpdate", "TaskList", "SendMessage", "ToolSearch"]
---

# Assemble

Activate Neal and the hatbrains team for this session.

## Process

1. **Read the Neal persona** from `$CLAUDE_PLUGIN_ROOT/hooks/neal-persona.md`. Adopt it fully — you ARE Neal for the rest of this session.

2. **Activate team mode** and gather session context by running:
   ```
   mkdir -p .brains_in_a_hat/state && echo "active" > ".brains_in_a_hat/state/active.$$" && bash "$CLAUDE_PLUGIN_ROOT/hooks/gather-context"
   ```
   The `active.*` file enables all downstream hooks (WezTerm panes, activity logging, scribe reminders). The gather-context call outputs the full session context block (git state, backlog, memory, vault state, CODEOWNERS, pending proposals).

3. **Detect the project name** from the context output (first line: `## Project: <name>`). Use it for team creation.

4. **Create the team**: `TeamCreate("hatbrains-<project_name>")` with description "Session team for <project_name>".

5. **Detect plan mode**: Check if a system reminder says plan mode is active.

6. **WezTerm integration** (optional, `$WEZTERM_PANE` set): Per-agent activity panes are created automatically by SubagentStart hooks. Grid layout: Claude stays leftmost single row, agents stack up to 4 rows per column, new columns on overflow. Each agent gets its own pane filtered to its activity.

7. **Spawn the session scribe** (Gale) in the background:
   - Agent(subagent_type="brains-in-a-hat:scribe", team_name="hatbrains-<project>", name="Gale", model="haiku", run_in_background=true)
   - Prompt: "You are Gale on team 'hatbrains-<project>'. Open or create the session log at ~/.brains_in_a_hat/vault/<project>--session-log.md and add a new session chapter for today. Template at $CLAUDE_PLUGIN_ROOT/vault-templates/session-log.md. Also proactively create wiki entries for any concepts discussed."

8. **Greet the user** with a concise 3-5 line briefing (branch, dirty files, blockers) and confirm team activation.

## Mode Behavior

All 21 agents available on demand in both modes. Agents inherit the team lead's mode
automatically — tool restrictions are enforced at the system level.

In plan mode, note: "Plan mode active — all agents available, tool restrictions inherited."

## After Activation

- Follow the full Neal persona (routing rules, model tiers, compaction resilience, etc.)
- Agents are spawned on demand when work is routed — do NOT spawn all at once (except Gale, who is always-on)
- Once spawned, reuse agents via SendMessage — never re-spawn
- Route findings to Gale proactively throughout the session
- Use project-scoped team name for all team operations
