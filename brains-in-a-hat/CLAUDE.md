# brains-in-a-hat plugin

Claude Code plugin providing a 21-agent team ("hatbrains") managed by Neal, chief of staff.

## Project Structure

- `agents/` — agent definitions (one `.md` per specialist, 21 total)
- `hooks/` — lifecycle hooks and persona (`hooks.json` wiring, `session-start` bootstrap, `neal-persona.md` brain)
- `commands/` — user-invocable slash commands (`retro`, `review`, `cleanup`; most lifecycle events are now auto-triggered via hooks, not manual commands)
- `skills/` — auto-loaded Claude Code skills (`assemble/` — activates the team)
- `vault-templates/` — Obsidian-compatible templates for persistent artifacts (retro, decision, research, architecture, qa-review, patterns, session-log, wiki, workflow)
- `examples/` — example configs copied on first run (user-preferences.json, domain-config.json)
- `.claude-plugin/` — plugin manifest (plugin.json)

## Naming Conventions

- All file names: kebab-case (`session-manager.md`, `meta-retro.md`, `qa-review.md`)
- Agent names in roster: PascalCase single names (`Mason`, `Reed`, `Paige`)
- Team name: `hatbrains-<project>` (e.g., `hatbrains-brains-in-a-hat`) — resolved at runtime via `detect_project_name()` in `hooks/lib-common.sh`

## Hook Lifecycle Order

`SessionStart` > `UserPromptSubmit` > `SubagentStart` > `SubagentStop` > `SessionEnd`

Plus tool-level hooks: `PreToolUse`, `PostToolUse`

## Key Files

- `hooks/neal-persona.md` — Neal's full prompt: team roster, routing rules, task-list primacy, plan mode, model tiers, retro automation, pivot detection
- `hooks/session-start` — bootstrap script (vault dirs, stale-state cleanup, source==compact detection); no persona injection — that happens via `/assemble`
- `hooks/first-prompt-greeting` — detects `/assemble`, creates active flag, injects `gather-context` briefing, emits compaction recovery + retro-due + post-mortem instructions, injects CURRENT FOCUS on every prompt
- `hooks/hooks.json` — hook wiring (all lifecycle events: UserPromptSubmit, SessionStart, SessionEnd, PreCompact, SubagentStart, SubagentStop, PreToolUse, PostToolUse)
- `hooks/enforce-neal-allowlist` — PreToolUse catch-all: restricts Neal to read + delegate + tasks + curated read-only Bash; subagents bypass via in-subagent.* markers
- `hooks/inject-subagent-context` — SubagentStart: emits PROTOCOLS block + SHARED CONTEXT (curated by Gale) + per-agent skills suffix
- `agents/scribe.md` — Gale's persona: session log + shared-context curator
- `agents/meta-retro.md` — Mira's persona: checkpoint + final retro modes with concurrency lock
- `agents/session-manager.md` — Reed's persona: briefing + persist modes (no retro writing — that's Mira's job)

## Model Tiers

Dynamic per-task selection — always start cheap, escalate only when needed:

- **haiku** (default): all agents start here. Rich personas make haiku punch above its weight.
- **sonnet** (escalate): multi-file analysis, code generation, nuanced review, structured comparison
- **opus** (advisor only): brief strategic consultation (≤700 tokens) for complex plan approval review, hard routing decisions, multi-approach tradeoffs. Never for full task execution. Simulated via short-lived Agent spawn with `[opus-justified][advisor]` tags (the API-native `advisor_20260301` beta is not yet exposed by Claude Code).

A PreToolUse hook advises when the chosen model looks too expensive for the task.

## Vault Structure

Flat Obsidian-native vault at `~/.brains_in_a_hat/vault/`:
- All notes at root — categorized by `type:` and `project:` frontmatter properties
- `attachments/` — images, plots, wandb exports
- No `projects/` or `wiki/` subdirs — properties replace paths

All vault files use Dataview frontmatter (`type`, `project`, `agents`, `date`, `tags`, `status`) and `[[wikilinks]]`. Use `vault_find <type> [<project>]` helper in hooks to search by property.

## Neal's Tool Restrictions

Neal (parent session in team mode) operates under an allowlist enforced by `hooks/enforce-neal-allowlist`:
- **Allowed**: Read, Grep, Glob, LS, Agent, SendMessage, Task*, Team*, AskUserQuestion, EnterPlanMode, ExitPlanMode, ToolSearch, Skill, Bash (plugin infrastructure + curated read-only: `gh list/view/api/search`, `git log/status/diff/show/blame/config --get`, `ls`, `cat`, `head`, `tail`, `wc`, `file`, `pwd`, `whoami`, `date`, with shell metacharacters rejected)
- **Blocked**: Write, Edit, NotebookEdit, WebSearch, WebFetch, destructive Bash (anything containing `;`, `|`, `&`, `>`, `$`, backticks, or not on the read-only allowlist)
- Subagents bypass the allowlist. Detection is via `.brains_in_a_hat/state/in-subagent.<id>` marker files written by `SubagentStart` and removed by `SubagentStop`; if any such marker exists, the hook exits allow. This replaces the prior `transcript_path` regex which was dead code (the PreToolUse transcript_path refers to the parent session, not the subagent, so the old regex never matched).

## Automation

The plugin is built around `/assemble` being the **only manual command you ever type**. Everything else fires automatically via lifecycle hooks:

- **Session briefing** — `/assemble` triggers `first-prompt-greeting`, which runs `gather-context` and injects the full briefing as `additionalContext` in one shot. No separate `/team-briefing` command (deleted).
- **Compaction recovery** — `PreCompact` writes `compact-pending.<sid>`; on the next prompt, `first-prompt-greeting` emits a `COMPACTION RECOVERY` systemMessage instructing Neal to re-read session-state.json and activity.jsonl.
- **Checkpoint retro** — same `PreCompact` also writes `retro-pending.<sid>="checkpoint"`; post-compact `first-prompt-greeting` instructs Neal to spawn Mira in `mode=checkpoint` (fire-and-forget, background).
- **Final retro** — `SessionEnd` writes `retro-pending.<sid>="final"` and instructs Neal to spawn Mira (`mode=final`) + Reed (`mode=persist`) + Gale-finalize all in parallel. Reed handles decision promotion + preferences; Mira handles retrospective writing (stripped from Reed to eliminate duplication).
- **Session end snapshot** — `SessionEnd` also copies `session-state.json` to `session-end-snapshot.json` as a durable safety net. If the previous session ended without Neal actioning the fanout, the next session's `first-prompt-greeting` detects the snapshot and instructs Neal to spawn Reed(mode=persist) to process it.
- **Shared context curator** — Gale writes to `session-state.json` (findings, active_tasks, current_focus, warnings, open_questions) on every significant SendMessage under a directory lock. `inject-subagent-context` reads this on every SubagentStart and emits a `SHARED CONTEXT` block so new team members inherit team state for free.
- **Pivot detection** — `first-prompt-greeting` injects `CURRENT FOCUS: <value>` on every prompt when team is active. Neal compares new prompts against current_focus and suggests `/compact` when a significant pivot is detected.
- **Advisory vault-check** — `pretool-agent-check` emits a `VAULT HINT` as `additionalContext` instead of blocking the spawn. The spawned agent decides whether to read the cited files.
- **Permission requests from teammates** — two types: (1) **Tool perm requests**: CC fires a `PermissionRequest` hook event in the lead's session; `hooks/handle-permission-request` auto-approves non-destructive requests and denies+interrupts destructive patterns (no Neal involvement needed). (2) **Plan approval requests**: teammate in plan mode sends a message to Neal when planning is done; Neal approves or rejects via SendMessage.

**Manual escape hatches** (if you want to force a lifecycle action): `/retro` (mid-task retro on demand), `/review` (pre-commit QA advisory), `/cleanup` (opportunistic hygiene sweep). None of these are lifecycle-driven — use them when you explicitly want to.

## Agent Spawning

Agents are spawned on demand, not at session start — except Gale (scribe), who is always-on and spawned during `/assemble`. Neal tracks which agents have been spawned and reuses them via SendMessage for subsequent tasks.

## Session Scribe (Gale)

Gale maintains a markdown session log at `~/.brains_in_a_hat/vault/<project>--session-log.md` (Obsidian-viewable, `typst` fenced blocks for architecture diagrams). Spawned at team activation, kept alive via SendMessage. Records hypotheses, methods, metrics, wandb links, results, interpretations, and related work. Each session is a timestamped chapter. Proactively creates wiki entries (`type: wiki`) for concepts, techniques, and tools discussed.

## Plan Mode

Plan mode restricts file mutations (Write, Edit, destructive Bash). All 21 agents are available — they automatically inherit the team lead's mode, so tool restrictions are enforced at the system level.

## Git Workflow

**No direct pushes to main.** Use branches + PRs.

- Commits auto-bump **patch** version (x.x.X) in all `plugin.json` files
- PR merges auto-bump **minor** version (x.X.0)
- **Major** bumps (X.0.0) are manual
- Skip bump with `SKIP_VERSION_BUMP=1 git commit ...`
- Override push protection with `ALLOW_MAIN_PUSH=1 git push ...`

Git hooks live in `scripts/git-hooks/`. Install after clone:
```bash
cp scripts/git-hooks/* .git/hooks/ && chmod +x .git/hooks/pre-*
```
