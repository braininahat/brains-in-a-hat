# brains-in-a-hat plugin

Claude Code plugin providing an orchestrated team (Neal + lazy-spawned Dewey/Ebert/Marco/Wright + on-demand Builders) with closed-loop self-improvement and hybrid memory: harness-native per-repo memory plus an optional, Obsidian-browsable cross-repo vault.

Requires Claude Code ≥ 2.1.178 (implicit agent teams) and `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. There is no `TeamCreate`/`TeamDelete` anywhere in this plugin — see [Team naming](#team-naming).

## Team roster

| Real name | Role | subagent_type | Model | Spawn |
|-----------|------|---------------|-------|-------|
| Neal | Orchestrator | — (main thread) | session model (recommended: **opus**) | always present |
| Dewey | Librarian | `brains-in-a-hat:librarian` | sonnet | lazy — first cross-repo/decision/journal intent |
| Ebert | Critic | `brains-in-a-hat:critic` | sonnet | lazy — first review intent (a diff/changeset exists) |
| Marco | Scout | `brains-in-a-hat:scout` | sonnet | lazy — first external-research intent |
| Wright | Architect | `brains-in-a-hat:architect` | sonnet | lazy — first design/blueprint intent (no diff yet) |
| Ada | Builder | `brains-in-a-hat:builder` | haiku \| sonnet \| session model — Neal picks per spawn | on-demand |
| Grace | Builder | `brains-in-a-hat:builder` | haiku \| sonnet \| session model — Neal picks per spawn | on-demand |
| Shannon | Builder | `brains-in-a-hat:builder` | haiku \| sonnet \| session model — Neal picks per spawn | on-demand |

**Every teammate is lazy.** Nobody is spawned upfront. Neal spawns a singleton (Dewey/Ebert/Marco/Wright) the first time a matching intent arrives, via `Agent(name=<RealName>, ...)`; `SendMessage` resumes it thereafter — it does **not** spawn one. `guard-sendmessage` (see [Hook lifecycle](#hook-lifecycle)) denies a message to any name that isn't yet a live member of the session's team, with a spawn hint, which is what makes lazy spawning safe instead of falling into the upstream silent-drop bug (#25135).

**Builders** (Ada/Grace/Shannon) are spawned on-demand for implementation work. The ML/infra/science domain split is a **naming convention**, not a routing rule or a different lane — all three share `subagent_type=brains-in-a-hat:builder` and identical repo access; a project's own `CLAUDE.md` is the real source of domain context, not the builder's name. Cap: 3 concurrent. Model tier is chosen by Neal per spawn: **haiku** only for mechanical, single-scope, spec-complete tasks with no open decisions; **sonnet** is the default (pinned in `builder.md`); the **session model** (opus) for cross-cutting refactors, debugging, or specs with open questions. When unsure: sonnet.

## Project Structure

- `agents/` — agent definitions (`librarian.md`, `critic.md`, `builder.md`, `scout.md`, `architect.md`).
- `hooks/` — lifecycle hooks and Neal's persona prompt (see `hooks/README.md` for the full file inventory and execution-order diagram):
  - `hooks.json` — wiring for all lifecycle events. Every command wraps its own `mkdir -p .brains_in_a_hat/state` ahead of the stderr redirect, so a fresh repo can't deadlock hooks on their first invocation.
  - `session-start` — bootstrap state dir, age-based marker reaping, `.gitignore` write, resume/compact recovery marker.
  - `new-roster-bootstrap` — first-prompt-of-session orientation: kill-switch check, lazy-roster orientation, vault preflight, recovery banner, Dewey backlog nudge.
  - `inject-context` — SubagentStart hook. Injects main-thread transcript slice, a session-derived ROSTER block, and a `MEMORY.md`-index pointer into every teammate spawn.
  - `librarian-tick` — TeammateIdle hook for Dewey. Re-engages via `exit 2` + stderr; transcript-hash-keyed cursor with cross-transcript sweep; NOOP-receipt-or-commit advance model.
  - `enforce-lanes` — the single PreToolUse dispatcher, keyed on the per-call `agent_type` field: empty ⇒ Neal's read+delegate allowlist; non-empty ⇒ the calling role's write lane. Replaces the old `enforce-neal-allowlist` + `enforce-teammate-lanes` pair and all `in-subagent.*` marker-file machinery.
  - `guard-sendmessage` — PreToolUse[SendMessage]. Denies messages to names that aren't yet live team members.
  - `capture-research` — PostToolUse (WebSearch/WebFetch/context7). Auto-captures external research results as content-addressed vault markdown; gated on the vault being a git repo; atomic write; dedup via same key→same path.
  - `vault-check` — PreToolUse (WebSearch/WebFetch/context7). Advisory only (never blocks); gated on the vault being a git repo; emits `VAULT HINT [FRESH|STALE]` when a cache hit exists; `[vault-reviewed]` suppresses.
  - `lib-common.sh` — shared helpers (`derive_project_key`, `derive_project_group`, `_project_json_get`, `vault_is_git_repo`, vault path resolution).
  - `lib-research.sh` — research-cache helpers (`compute_cache_key`, `cache_path_for`, `ttl_for_type`, `is_stale`, `find_cache_hit`, `read_cache_field`, etc.).
  - `neal-persona.md` — Neal's full prompt (lazy roster with real names, routing, architect boundary, builder model tiers, cache-first retrieval, `RECORD-REQUEST` + `UPSTREAM-ISSUE-REQUEST` sentinels, peer agency, meta-analysis).
- `commands/` — empty by design. The only user-facing entry point is `/assemble`. Everything else is routed by Neal as a natural-language intent (review, ship, research, implement, design, recall).
- `skills/assemble/` — the sole user-facing command. Auto-fires via the `new-roster-bootstrap` hook on first prompt; only invoked manually if hooks were disabled or the user wants to re-adopt the persona mid-session. It no longer spawns anyone — there's no team to build, since the roster is entirely lazy.
- `scripts/vault-init.sh` — bootstrap helper for the **optional** vault. `detect | init | clone | auto` subcommands. Auto-detects `<gh-user>/hatbrains-vault` on new devices.
- `scripts/file-plugin-issue.sh` — file a GitHub issue on `braininahat/brains-in-a-hat` from any project. Always targets the plugin repo regardless of CWD. Deduplicates by **exact** title match (case-sensitive) against `--search` candidates, so a fuzzy hit on an unrelated issue can no longer be mistaken for a duplicate. Used by Builders via the `UPSTREAM-ISSUE-REQUEST:` sentinel.
- `.claude-plugin/plugin.json` — manifest. Version `1.0.0-alpha`.

## Team naming

- **Implicit team, no `TeamCreate`/`TeamDelete`.** Every session gets exactly one team, derived from the session id: `~/.claude/teams/session-<first 8 hex of session_id>/config.json`. There is no `hatbrains-<repoKey>` team name and no `team_name=` parameter anywhere in this plugin — a value passed there is silently ignored by the harness.
- **The main thread's routable identity is `team-lead`**, not `Neal`. Neal is the persona; `team-lead` is the name a teammate must use with `SendMessage` to reach the main thread. Every place a persona file used to say "SendMessage to Neal" now says `team-lead` — misrouting a message to `Neal` would either error or (worse) silently vanish.
- Teammates are addressed by **real name** via `SendMessage`: `Dewey`, `Ebert`, `Marco`, `Wright`, `Ada`, `Grace`, `Shannon` (or `Ada-2` etc. for a second concurrent Builder in the same domain).
- `subagent_type` uses the role name (`brains-in-a-hat:librarian`, etc.) — the real name is only the spawn `name=` field. Lane enforcement keys on the per-call `agent_type`, not `name`.

## Architect role

Wright (Architect) is **read-only**. It produces design blueprints and architecture audits as a SendMessage output back to `team-lead`. Builder implements the blueprint; Wright never writes code or files. `enforce-lanes` denies Write/Edit/git-commit for `agent_type=brains-in-a-hat:architect`, identical to the Critic/Scout treatment.

**Boundary with Critic:** if there's a diff or changeset already in hand, it's Ebert's — Ebert gained a `verification` lens specifically so review isn't limited to reading a diff (it also drives the changed flow end-to-end). If there's no diff yet — a system design question, a blueprint needed before Builder starts, an architecture audit of something that doesn't exist as a changeset — it's Wright's.

Routing triggers: "design this", "blueprint before building", "architect this feature", "is our architecture sound for X", "plan the shape of Y".

## Builder specialization

All Builders share `subagent_type=brains-in-a-hat:builder` and full repo access. The ML/infra/science domain names (Ada/Grace/Shannon) are a **naming convention** for Neal's own bookkeeping, not a routing rule — a project's `CLAUDE.md` is the actual source of domain context, so Neal should feel free to pick whichever Builder name is free rather than agonize over best fit. Cap: 3 concurrent. A/B same-task opt-in available.

## Sentinels

### RECORD-REQUEST (cross-repo learnings, decisions, journal entries → Dewey)

`RECORD-REQUEST:` is now scoped to the **global vault layer only** — cross-repo shared learnings, decisions (ADRs), wiki concepts, and session-journal entries. Repo-scoped learnings and preferences no longer go through Dewey at all: Neal writes them directly to the harness per-project memory dir himself (an allowlist exception in `enforce-lanes`, see below).

```
SendMessage("Dewey", "RECORD-REQUEST: <what to record>. Scope: repoKey=<X>, projectGroup=<Y>.")
```

`librarian-tick` greps the transcript for this prefix and prepends a mandatory-write directive on Dewey's next tick. Dewey returns a commit SHA (or an explicit NOOP receipt if there was nothing to record); Neal surfaces it to the user. If no vault is configured, this sentinel has nowhere to go — Neal notes the decision in harness memory instead and tells the user cross-repo/decision history is off.

### UPSTREAM-ISSUE-REQUEST (plugin bugs/improvements → Builder)

Unchanged. When meta-analysis surfaces a bug or improvement in the **plugin itself** (not in the user's project):

```
SendMessage("<Ada|Grace|Shannon>", "UPSTREAM-ISSUE-REQUEST: <title> — <description>. Run scripts/file-plugin-issue.sh and return the issue URL.")
```

The Builder runs `scripts/file-plugin-issue.sh --title "..." --body "..."` (targets `braininahat/brains-in-a-hat`) and returns the URL. Neal surfaces it to the user. Neal cannot `gh issue create` directly (outside his allowlist).

**Repo-scoped learnings** Neal writes himself to harness memory. **Cross-repo/decision/journal entries** go to Dewey via `RECORD-REQUEST:`. **Plugin bugs/improvements** go to a Builder via `UPSTREAM-ISSUE-REQUEST:`.

## Memory — hybrid, two layers

**Hot / per-repo (always on):** Claude Code's own per-project memory (`~/.claude/projects/<slug>/memory/`) — auto-recalled by the harness into context, zero onboarding. Neal writes here directly (allowlist exception, see below); this replaces what used to be `<repoKey>--learnings.md` in the vault.

**Global / cross-repo (optional):** the vault at `$BRAINS_VAULT_DIR` (default `~/.hatbrains`), holding only what's genuinely global:
- `<projectGroup>--shared--learnings.md` — cross-repo learnings for a constellation
- `<descriptor>--decision.md` — one file per decision (ADR pattern)
- `<concept>.md` — wiki entries
- `<projectGroup>--session-log.md` — chronological work entries (the journal)
- `research-cache--<subtype>--<shorthash>.md` — auto-captured external research
- `index.md` — top-level dashboard (Dataview queries)

**No vault configured or not a git repo → no Dewey, no cache, no journal — everything else works exactly the same.** `new-roster-bootstrap` preflights with `vault_is_git_repo`; `capture-research` and `vault-check` gate on the same check and simply no-op. There's no `_solo` cross-contamination concern anymore: an ungrouped repo has no shared vault file to leak into, because ungrouped repos only ever touch the per-repo (harness memory) layer.

Frontmatter fields on vault files: `type` (shared-learnings | session-log | decision | wiki | index | research-cache), `projectGroup`, `repoKey`, `date`, `lastUpdated`, `status`, `tags`, `related`. Tags and status go in frontmatter, never inline `#hashtags`. Cross-references via `[[wikilinks]]`.

Dewey owns vault git ops — `git pull --rebase --autostash` on first use each session, `git add -A; git commit; git push` on every confirmed tick.

Design philosophy: **a graph database without a database server.** Markdown files + frontmatter + wikilinks. No daemon, no schema migrations, no proprietary store. Obsidian remains the optional human-browsing layer over the vault; nothing in the plugin requires it.

## Project keying (vault only — works across worktrees and devices)

Every repo can have `.brains_in_a_hat/project.json`:
```json
{
  "projectGroup": "pulse",
  "repoKey": "pulse-model"
}
```

This only matters for the optional global vault layer (grouping repos into a constellation, naming the shared-learnings file). The hot per-repo memory layer is keyed automatically by Claude Code itself and needs no configuration.

`derive_project_key()` and `derive_project_group()` in `lib-common.sh` read this file first, falling back to git remote URL and basename. Worktrees inherit the same `project.json` → same `repoKey` → same vault entries.

## Hook lifecycle

`SessionStart` (state dir bootstrap, marker reaping by age, `.gitignore` write, resume/compact recovery marker) → `UserPromptSubmit` (`new-roster-bootstrap`: kill-switch check, lazy-roster orientation, vault preflight, recovery banner, Dewey backlog nudge) → user prompt → Neal routes → `SubagentStart` (`inject-context`: transcript slice + ROSTER block + memory-index pointer) → teammate works → `TeammateIdle` (`librarian-tick`: transcript-hash cursor, exit-2 re-engage, commit-or-NOOP advance) → `PreToolUse` (`enforce-lanes` on every call, keyed on per-call `agent_type`; `guard-sendmessage` on `SendMessage`; `vault-check` advisory on web/context7 calls) → `PostToolUse` (activity log; `capture-research` auto-writes vault cache for web/context7 results, gated on vault presence) → ... → `PreCompact` (compact-pending marker) → `SessionEnd` (logging only — no "final tick" instruction; that path is dead now that hook output there isn't seen by the model).

No phased rituals. No `/retro`, no `/cleanup`, no manual `/assemble` flow beyond the one-time persona (re-)adoption. Improvement happens inline through Dewey's curation (when a vault exists) and Neal's meta-analysis.

Full execution-order diagram: `hooks/README.md`.

## Neal's tool restrictions

Enforced by the `enforce-lanes` PreToolUse dispatcher (empty `agent_type` branch). Neal can: Read, Grep, Glob, Agent, SendMessage, `Task*` (TaskCreate/TaskUpdate/TaskList/TaskGet/TaskOutput/TaskStop), AskUserQuestion, EnterPlanMode/ExitPlanMode, ToolSearch, Skill, plugin-infrastructure Bash, and a curated read-only Bash allowlist (`gh` list/view/api/search including `gh api <endpoint>`, `git` log/status/diff/show/branch/remote/etc., `ls cat head tail wc file pwd whoami date`). Write/Edit are allowed **only** under `.claude/plans/` or the harness per-project memory dir (`~/.claude/projects/*/memory/`) — the hybrid-memory allowlist exception that lets Neal record repo-scoped learnings himself.

There is no `Team*` tool family anymore (implicit teams have no such tools), and `LS` was dropped from the allowlist — it isn't a real Claude Code tool name, so listing it there never did anything.

Neal CANNOT: Write/Edit outside those two exceptions, NotebookEdit, WebSearch, WebFetch, destructive Bash, or `gh issue create`. Anything requiring those goes to a teammate.

Teammates are governed by `enforce-lanes`' non-empty-`agent_type` branch: Dewey (`librarian`) may only Write/Edit/commit/push under `$VAULT_DIR`; Ebert/Marco/Wright (`critic`/`scout`/`architect`) are read-only (no Write/Edit/NotebookEdit/git-commit/push); Ada/Grace/Shannon (`builder`) have full access. Detection is per-call: the hook reads `agent_type`/`agent_id` straight from each tool call's payload — there are no `in-subagent.*` marker files to write, reap, or let go stale.

## Git workflow

- Pre-commit hook: only bumps `plugin.json` versions for plugins with staged changes. Skips plugins with prerelease tags (e.g., `1.0.0-alpha`). Always syncs `marketplace.json` from each plugin's `plugin.json`.
- Post-merge hook: tags `v<version>` on main when the brains-in-a-hat plugin version changes.
- Skip version bump: `SKIP_VERSION_BUMP=1 git commit ...`.
- Major bumps (X.0.0) are manual — strip the `-alpha`/`-beta` tag when ready to release.

Git hooks live in `scripts/git-hooks/`. Install after clone:
```bash
cp scripts/git-hooks/* .git/hooks/ && chmod +x .git/hooks/pre-*
```
