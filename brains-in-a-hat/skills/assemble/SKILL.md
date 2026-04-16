---
description: "Activate the brains-in-a-hat team — 20 specialist agents managed by Neal. Use to opt into team mode for the current session."
argument-hint: "(no arguments)"
allowed-tools: ["Agent", "Read", "Grep", "Glob", "TeamCreate", "TaskCreate", "TaskUpdate", "TaskList", "SendMessage", "ToolSearch"]
---

# Assemble

Activate Neal and the hatbrains team for this session.

## Process

1. **Read the Neal persona** from `$CLAUDE_PLUGIN_ROOT/hooks/neal-persona.md`. Adopt it fully — you ARE Neal for the rest of this session.

2. **Activate team mode** — the activation is automatic. The `first-prompt-greeting` UserPromptSubmit hook has already:
   - Detected `/assemble` and created `.brains_in_a_hat/state/active.$$` (the activation flag that enables all downstream hooks — activity logging, scribe reminders, Neal's allowlist).
   - Run `gather-context` (which has `$CLAUDE_PLUGIN_ROOT` set in hook env — the skill's Bash env does not) and injected the full session context block (git state, backlog, memory, vault state, CODEOWNERS, pending proposals) as `additionalContext` on this same prompt.

   Read that briefing from your conversation context. The first line `## Project: <name>` is what you'll use in step 3.

3. **Detect the project name** from the context output (first line: `## Project: <name>`). Use it for team creation.

4. **Clear any stale team then create fresh**: call `TeamDelete("hatbrains-<project_name>")` first — this removes the old config and its stale `leadSessionId` so the next step registers the current session as lead. If it fails (team doesn't exist yet), continue. Then call `TeamCreate("hatbrains-<project_name>")` with description "Session team for <project_name>".

5. **Detect plan mode**: Check if a system reminder says plan mode is active.

6. **Spawn the session scribe** (Gale) in the background:
   - Agent(subagent_type="brains-in-a-hat:scribe", team_name="hatbrains-<project>", name="Gale", description="Spawn session scribe Gale", model="haiku", mode="bypassPermissions", run_in_background=true)
   - Prompt: "You are Gale on team 'hatbrains-<project>'. You have TWO core responsibilities: (1) maintain the vault session log at ~/.brains_in_a_hat/vault/<project>--session-log.md (open or create from $CLAUDE_PLUGIN_ROOT/vault-templates/session-log.md, add a new session chapter for today, append findings as they arrive); (2) curate shared context by writing to .brains_in_a_hat/state/session-state.json — append to .findings[] ring buffer of 20 on every significant SendMessage, refresh .active_tasks from TaskList in the same write, update .current_focus on focus updates, record .warnings and .open_questions as teammates report them. Use the directory-lock pattern (mkdir .brains_in_a_hat/state/session-state.json.lock.d). Also proactively create wiki entries for concepts discussed."

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
