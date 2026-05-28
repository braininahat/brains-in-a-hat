# brains-in-a-hat plugin

Claude Code plugin providing a 5-agent team (Neal + Librarian, Critic, Builder, Scout) with closed-loop self-improvement and Obsidian-synced external memory.

## Project Structure

- `agents/` — agent definitions (`librarian.md`, `critic.md`, `builder.md`, `scout.md`).
- `hooks/` — lifecycle hooks and Neal's persona prompt:
  - `hooks.json` — wiring for all hook events.
  - `session-start` — bootstrap state dir and stale-marker cleanup.
  - `new-roster-bootstrap` — first-prompt-of-session orientation. Tells Neal to TeamCreate + spawn Librarian.
  - `inject-context` — SubagentStart hook. Injects the last N user/assistant turns from the main thread transcript plus the active learnings files into every teammate spawn.
  - `librarian-tick` — TeammateIdle hook for Librarian. Slices new transcript turns, re-engages Librarian to classify/curate/commit/push.
  - `enforce-neal-allowlist` — PreToolUse. Restricts Neal to read+delegate; teammates bypass.
  - `lib-common.sh` — shared helpers (`derive_project_key`, `derive_project_group`, `_project_json_get`, vault path resolution).
  - `neal-persona.md` — Neal's full prompt (roster, routing, meta-analysis, retrieval routing).
- `commands/` — empty by design. The only user-facing entry point is `/assemble`. Everything else is routed by Neal as a natural-language intent (review, ship, research, implement, recall).
- `skills/assemble/` — the sole user-facing command. Auto-fires via the `new-roster-bootstrap` hook on first prompt; only invoked manually if hooks were disabled or the user wants to re-engage mid-session.
- `scripts/vault-init.sh` — bootstrap helper. `detect | init | clone | auto` subcommands. Auto-detects `<gh-user>/hatbrains-vault` on new devices.
- `.claude-plugin/plugin.json` — manifest. Version `1.0.0-alpha`.

## Team naming

- Team name: `hatbrains-<repoKey>` where `repoKey` comes from `.brains_in_a_hat/project.json` (preferred), the git remote, or repo basename.
- Teammates addressed by role name via SendMessage: `Librarian`, `Critic`, `Builder`, `Scout`.

## Vault

The vault is a **personal git repository** at `$BRAINS_VAULT_DIR` (default `~/.hatbrains`). Convention: a private GitHub repo named `<gh-user>/hatbrains-vault`. Librarian owns git ops — `git pull --rebase --autostash` on session start; `git add -A; git commit; git push` on every TeammateIdle tick.

**Flat layout, frontmatter-driven (no subdirectories):**
- `<repoKey>--learnings.md` — per-repo learnings (frontmatter at top, bullets below)
- `<projectGroup>--shared--learnings.md` — cross-repo learnings for a constellation
- `<projectGroup>--session-log.md` — chronological work entries
- `<descriptor>--decision.md` — one file per decision (ADR pattern)
- `<concept>.md` — wiki entries
- `index.md` — top-level dashboard (Dataview queries)
- `attachments/` — images, plots

Frontmatter fields: `type` (learnings | session-log | decision | wiki | index | preference), `projectGroup`, `repoKey`, `date`, `lastUpdated`, `status`, `tags`, `related`. Tags and status go in frontmatter, never inline `#hashtags`. Cross-references via `[[wikilinks]]`. Dataview queries provide the discoverability.

Design philosophy: **a graph database without a database server.** Markdown files + frontmatter + wikilinks. No daemon, no schema migrations, no proprietary store.

## Project keying (works across worktrees and devices)

Every repo can have `.brains_in_a_hat/project.json`:
```json
{
  "projectGroup": "pulse",
  "repoKey": "pulse-model"
}
```

`derive_project_key()` and `derive_project_group()` in `lib-common.sh` read this file first, falling back to git remote URL and basename. Worktrees inherit the same `project.json` → same `repoKey` → same vault entries.

## Hook lifecycle

`SessionStart` (cleanup) → `UserPromptSubmit` (new-roster-bootstrap on first turn) → user prompt → Neal acts → `SubagentStart` (inject-context for spawns) → teammate works → `TeammateIdle` (librarian-tick for Librarian) → `PreToolUse` (enforce-neal-allowlist on Neal's calls) → `PostToolUse` (activity log) → ... → `PreCompact` (compact-pending marker) → `SessionEnd` (instruct Neal to tell Librarian to finalize).

No phased rituals. No `/retro`, no `/cleanup`, no manual `/assemble` flow. Improvement happens inline through Librarian's curation and Neal's meta-analysis.

## Neal's tool restrictions

Enforced by `enforce-neal-allowlist` PreToolUse hook. Neal can: Read, Grep, Glob, LS, Agent, SendMessage, Task*, Team*, AskUserQuestion, EnterPlanMode, ExitPlanMode, ToolSearch, Skill, and a curated read-only Bash allowlist (`gh` list/view/api, `git` log/status/diff/show, `ls cat head tail wc file pwd whoami date`).

Neal CANNOT: Write, Edit, NotebookEdit, WebSearch, WebFetch, or destructive Bash. Anything requiring those goes to a teammate.

Teammates bypass the allowlist (`mode: bypassPermissions` at spawn) and never bubble tool permission requests. Detection: `state/in-subagent.<id>` markers written by SubagentStart and removed by SubagentStop.

## Git workflow

- Pre-commit hook: only bumps `plugin.json` versions for plugins with staged changes. Skips plugins with prerelease tags (e.g., `1.0.0-alpha`). Always syncs `marketplace.json` from each plugin's `plugin.json`.
- Post-merge hook: tags `v<version>` on main when the brains-in-a-hat plugin version changes.
- Skip version bump: `SKIP_VERSION_BUMP=1 git commit ...`.
- Major bumps (X.0.0) are manual — strip the `-alpha`/`-beta` tag when ready to release.

Git hooks live in `scripts/git-hooks/`. Install after clone:
```bash
cp scripts/git-hooks/* .git/hooks/ && chmod +x .git/hooks/pre-*
```
