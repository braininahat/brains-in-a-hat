# brains-in-a-hat plugin

Claude Code plugin providing a 21-agent team ("hatbrains") managed by Neal, chief of staff.

## Project Structure

- `agents/` — agent definitions (one `.md` per specialist, 21 total)
- `hooks/` — lifecycle hooks and persona (`hooks.json` wiring, `session-start` bootstrap, `neal-persona.md` brain)
- `commands/` — user-invocable slash commands (team-briefing, team-debrief, team-retro, team-review, team-cleanup)
- `skills/` — auto-loaded Claude Code skills (`assemble/` — activates the team)
- `vault-templates/` — Obsidian-compatible templates for persistent artifacts (retro, decision, research, architecture, qa-review, patterns, dashboard)
- `examples/` — example configs copied on first run (user-preferences.json, domain-config.json)
- `dashboard/` — global dashboard server (port 8787)
- `.claude-plugin/` — plugin manifest (plugin.json)

## Naming Conventions

- All file names: kebab-case (`session-manager.md`, `team-briefing`, `qa-review.md`)
- Agent names in roster: PascalCase single names (`Mason`, `Reed`, `Paige`)
- Team name: `hatbrains-<project>` (e.g., `hatbrains-brains-in-a-hat`) — resolved at runtime via `detect_project_name()` in `hooks/lib-common.sh`

## Hook Lifecycle Order

`SessionStart` > `UserPromptSubmit` > `SubagentStart` > `SubagentStop` > `SessionEnd`

Plus tool-level hooks: `PreToolUse`, `PostToolUse`

## Key Files

- `hooks/neal-persona.md` — Neal's full prompt: team roster, routing rules, plan mode, model tiers
- `hooks/session-start` — bootstrap script (vault dirs, dashboard, stale-state cleanup); no persona injection — that happens via `/assemble`
- `hooks/first-prompt-greeting` — detects `/assemble`, creates active flag, injects compaction-recovery breadcrumb
- `hooks/hooks.json` — hook wiring (all lifecycle events)
- `hooks/enforce-neal-allowlist` — PreToolUse catch-all: restricts Neal to read + delegate + tasks only

## Model Tiers

Dynamic per-task selection — always start cheap, escalate only when needed:

- **haiku** (default): all agents start here. Rich personas make haiku punch above its weight.
- **sonnet** (escalate): multi-file analysis, code generation, nuanced review, structured comparison
- **opus** (plan mode only): architecture design, multi-factor tradeoffs, ambiguous research synthesis

A PreToolUse hook advises when the chosen model looks too expensive for the task.

## Vault Structure

Flat Obsidian-native vault at `~/.brains_in_a_hat/vault/`:
- `projects/<project>/` — all project artifacts (flat, no subdirs)
- `wiki/` — global reusable knowledge (not project-scoped)

Files are categorized by `type:` frontmatter (retro, decision, research, architecture, qa-review), not directories. All vault files use Dataview frontmatter (`type`, `project`, `agents`, `date`, `tags`, `status`) and `[[wikilinks]]`.

## Neal's Tool Restrictions

Neal (parent session in team mode) operates under a strict allowlist enforced by `enforce-neal-allowlist`:
- **Allowed**: Read, Grep, Glob, LS, Agent, SendMessage, Task*, Team*, AskUserQuestion, EnterPlanMode, ExitPlanMode, ToolSearch, Skill, Bash (plugin infrastructure only)
- **Blocked**: Write, Edit, NotebookEdit, Bash (non-plugin), WebSearch, WebFetch, everything else
- Subagents are unrestricted — the allowlist only applies to the parent session

## Agent Spawning

Agents are spawned on demand, not at session start — except Gale (scribe), who is always-on and spawned during `/assemble`. Neal tracks which agents have been spawned and reuses them via SendMessage for subsequent tasks.

## Session Scribe (Gale)

Gale maintains a Typst session log at `~/.brains_in_a_hat/vault/projects/<project>/session-log.typ`. Spawned at team activation, kept alive via SendMessage. Records hypotheses, methods, metrics, wandb links, results, interpretations, and related work. Each session is a timestamped chapter. Compiles to PDF at session end.

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
