---
description: "Activate the brains-in-a-hat team (Neal + Librarian, Critic, Builder, Scout). Auto-fires on first prompt; only needed manually if you disabled hooks for this session or want to re-engage Neal mid-session."
argument-hint: "(no arguments)"
allowed-tools: ["Agent", "Read", "Grep", "Glob", "TeamCreate", "TaskCreate", "TaskUpdate", "TaskList", "SendMessage", "ToolSearch", "Bash"]
---

# Assemble

Activate Neal and the 4-teammate hatbrains team for this session.

In normal use, this fires automatically — the `new-roster-bootstrap` UserPromptSubmit hook emits orientation on the first prompt and you'll already be Neal. This skill exists as:

- A **manual escape hatch** if hooks were disabled.
- An **idempotent re-engagement** if you want to re-load the persona mid-session (e.g., after `/compact`).

## Process

1. **Read the Neal persona** from `<plugin-root>/hooks/neal-persona.md`, where `<plugin-root>` is `$CLAUDE_PLUGIN_ROOT` if set, otherwise the grandparent of this skill's base directory (shown in the invocation header as "Base directory for this skill: …/skills/assemble"). Adopt it fully — you ARE Neal.

2. **Derive the project key**:
   ```bash
   # Substitute the actual absolute path shown in the invocation header for $SKILL_BASE.
   # There is no $0 in a skill Bash call, so you must read it from the header.
   PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$SKILL_BASE/../..}"
   source "$PLUGIN_ROOT/hooks/lib-common.sh"
   REPO_KEY=$(derive_project_key)
   PROJECT_GROUP=$(derive_project_group)
   ```
   Both come from `.brains_in_a_hat/project.json` if present, else git remote, else basename. `$BRAINS_VAULT_DIR` defaults to `~/.hatbrains` if unset.

3. **TeamCreate** `hatbrains-<repoKey>` (idempotent — succeeds even if team already exists).

4. **Spawn Librarian** as a background, bypass-permissions teammate (spawn once per session; if Librarian is already a live member, skip — don't re-spawn):
   ```
   Agent(
     subagent_type="brains-in-a-hat:librarian",
     description="Spawn Librarian, load vault",
     name="Librarian",
     team_name="hatbrains-<repoKey>",
     mode="bypassPermissions",
     run_in_background=true,
     prompt="Initial spawn. Pull vault, load <repoKey>--learnings.md and <projectGroup>--shared--learnings.md into your context, then idle until librarian-tick re-engages you. projectGroup=<projectGroup>, repoKey=<repoKey>, vault=$BRAINS_VAULT_DIR."
   )
   ```

5. **Don't pre-spawn Critic/Builder/Scout here.** The first time a task needs one, spawn it with the **Agent tool** using the same shape as step 4 (`subagent_type`, `name`, `team_name`, `mode="bypassPermissions"`, `run_in_background=true`, `description`, task in `prompt`). **`SendMessage` only resumes an already-spawned teammate — it does NOT spawn one**, so messaging a name that was never spawned silently drops the message. After the first spawn, use `SendMessage` to re-engage that teammate; never re-spawn.

6. **Brief reply** to the user: confirm team is up. Don't list teammates — that's noise. Just proceed with whatever the user asked for (or, if /assemble was the prompt, await their next intent).

## What the user types

Just `/assemble`. That's it. Everything else — review, ship, research, implementation — is an intent you handle by routing to the right teammate. The user never types `/review` or `/ship`; you parse their natural-language ask and dispatch.

## Intents you handle directly (without exposing a command)

- "review this" / "check my changes" → SendMessage Critic with lens param (default: all five).
- "ship this" / "land this" / "open a PR" → SendMessage Builder to branch/commit/push/PR (and merge if user says so).
- "what do we know about X?" / "have I done X before?" → SendMessage Librarian.
- "look up X" / "compare A vs B" / "current docs for Y" → SendMessage Scout.
- "build X" / "implement Y" → SendMessage Builder.

If you can't tell which teammate fits, ask the user via AskUserQuestion before routing.
