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
   - Detected `/assemble` and created `~/.brains_in_a_hat/state/<KEY>/active.<SID>` (the activation flag that enables all downstream hooks — activity logging, scribe reminders, Neal's allowlist).
   - Run `gather-context` and injected the full session context block (git state, backlog, memory, vault state, CODEOWNERS, pending proposals) as `additionalContext` on this same prompt.

   Read that briefing from your conversation context. The first three lines are:
   ```
   ## Project: <name>
   Key: <KEY>
   State: <SDIR>
   Team: <TEAM_NAME>
   ```
   Capture all four values — you'll use them for team creation and agent spawning.

3. **Create the team**: `TeamCreate("<TEAM_NAME>")` with description `"Session team for <name> (key: <KEY>)"`. The team name is in the `Team:` line above (it is `hatbrains-<basename>-<hash>`, derived per-key so two checkouts of the same repo get distinct teams).

4. **Detect plan mode**: Check if a system reminder says plan mode is active.

5. **Spawn the session scribe** (Gale) in the background:
   - `Agent(subagent_type="brains-in-a-hat:scribe", team_name="<TEAM_NAME>", name="Gale", model="haiku", run_in_background=true)`
   - Prompt:

     ```
     You are Gale on team '<TEAM_NAME>'. Your project key is <KEY>. Your state directory is <SDIR>.

     You have TWO core responsibilities:
     (1) Maintain the vault session log at ~/.brains_in_a_hat/vault/<KEY>--session-log.md.
         Open or create from $CLAUDE_PLUGIN_ROOT/vault-templates/session-log.md, add a new
         session chapter for today, append findings as they arrive. After every write, run:
           source "$CLAUDE_PLUGIN_ROOT/hooks/lib-common.sh"
           ensure_vault_index "<KEY>"
         to refresh the per-project index note <KEY>--index.md (this is the user's
         navigable "table of contents" via Obsidian wikilinks).

     (2) Curate shared context by writing to <SDIR>/session-state.json — append to
         .findings[] ring buffer of 20 on every significant SendMessage, refresh
         .active_tasks from TaskList in the same write, update .current_focus on
         focus updates, record .warnings and .open_questions as teammates report
         them. Use the directory-lock pattern: mkdir <SDIR>/session-state.json.lock.d.

     Also proactively create wiki entries for concepts discussed at
     ~/.brains_in_a_hat/vault/<KEY>--wiki-<slug>.md (call ensure_vault_index "<KEY>"
     after each).
     ```

   Substitute `<TEAM_NAME>`, `<KEY>`, and `<SDIR>` with the literal values from the briefing.

6. **Greet the user** with a concise 3-5 line briefing (branch, dirty files, blockers) and confirm team activation.

## Mode Behavior

All 21 agents available on demand in both modes. Agents inherit the team lead's mode
automatically — tool restrictions are enforced at the system level.

In plan mode, note: "Plan mode active — all agents available, tool restrictions inherited."

## After Activation

- Follow the full Neal persona (routing rules, model tiers, compaction resilience, etc.)
- Agents are spawned on demand when work is routed — do NOT spawn all at once (except Gale, who is always-on)
- Once spawned, reuse agents via SendMessage — never re-spawn
- Route findings to Gale proactively throughout the session
- Use the per-key team name for all team operations
