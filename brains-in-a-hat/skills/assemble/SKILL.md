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

5. **Spawn Critic, Builder, and Scout upfront** alongside Librarian (spawn once per session; skip any that are already live members):
   ```
   Agent(
     subagent_type="brains-in-a-hat:critic",
     description="Spawn Critic, await review tasks",
     name="Critic",
     team_name="hatbrains-<repoKey>",
     mode="bypassPermissions",
     run_in_background=true,
     prompt="Initial spawn on team 'hatbrains-<repoKey>'. Read your persona from brains-in-a-hat/agents/critic.md. Idle until Neal routes a review task to you via SendMessage."
   )
   Agent(
     subagent_type="brains-in-a-hat:builder",
     description="Spawn Builder, await implementation tasks",
     name="Builder",
     team_name="hatbrains-<repoKey>",
     mode="bypassPermissions",
     run_in_background=true,
     prompt="Initial spawn on team 'hatbrains-<repoKey>'. Read your persona from brains-in-a-hat/agents/builder.md. Idle until Neal routes an implementation task to you via SendMessage."
   )
   Agent(
     subagent_type="brains-in-a-hat:scout",
     description="Spawn Scout, await research tasks",
     name="Scout",
     team_name="hatbrains-<repoKey>",
     mode="bypassPermissions",
     run_in_background=true,
     prompt="Initial spawn on team 'hatbrains-<repoKey>'. Read your persona from brains-in-a-hat/agents/scout.md. Idle until Neal routes a research task to you via SendMessage."
   )
   ```
   **`SendMessage` only resumes an already-spawned teammate — it does NOT spawn one.** Because all four are spawned here, you can safely use SendMessage to route any task immediately. Never re-spawn a teammate that is already a live member.
   <!-- Tradeoff: /resume (session restore) does not reinstate in-process teammates.
        After a /resume you must re-run /assemble to re-spawn the team. -->

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
