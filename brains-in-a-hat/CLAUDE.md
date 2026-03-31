# brains-in-a-hat plugin

Claude Code plugin providing a 19-agent team ("hatbrains") managed by Neal, chief of staff.

## Project Structure

- `agents/` — agent definitions (one `.md` per specialist, 19 total)
- `hooks/` — lifecycle hooks and persona (`hooks.json` wiring, `session-start` bootstrap, `neal-persona.md` brain)
- `skills/` — user-invocable slash commands (team-briefing, team-debrief, team-retro, team-review, team-cleanup)
- `vault-templates/` — Obsidian-compatible templates for persistent artifacts (retro, decision, research, architecture, qa-review, patterns, dashboard)
- `examples/` — example configs copied on first run (user-preferences.json, domain-config.json)
- `dashboard/` — global dashboard server (port 8787)
- `.claude-plugin/` — plugin manifest (plugin.json)

## Naming Conventions

- All file names: kebab-case (`session-manager.md`, `team-briefing`, `qa-review.md`)
- Agent names in roster: PascalCase single names (`Mason`, `Reed`, `Paige`)
- Team name: `hatbrains`

## Hook Lifecycle Order

`SessionStart` > `UserPromptSubmit` > `SubagentStart` > `SubagentStop` > `SessionEnd`

Plus tool-level hooks: `PreToolUse`, `PostToolUse`

## Key Files

- `hooks/neal-persona.md` — Neal's full prompt: team roster, routing rules, plan mode, model tiers
- `hooks/session-start` — bootstrap script injecting session context into Neal's prompt
- `hooks/hooks.json` — hook wiring (all lifecycle events)

## Model Tiers

**sonnet** (simpler tasks): session-manager, qa-engineer, docs-writer, meta-retro, ui-reviewer, testing-strategy, devops, packaging, profiler, ux-workflow, data-schema

**opus** (complex reasoning): architect, system-designer, researcher, domain-expert, qt-qml, mlops, signal-processing, hardware-device

## Vault Write Paths

Agents persist durable artifacts to `~/.claude/vault/projects/<project>/<category>/`:

| Category | Writers |
|---|---|
| `retros/` | session-manager, meta-retro |
| `decisions/` | domain-expert, session-manager |
| `research/` | researcher |
| `architecture/` | architect |
| `qa-reviews/` | qa-engineer |

All vault files use Dataview frontmatter (`type`, `project`, `agents`, `date`, `tags`, `status`) and `[[wikilinks]]`.

## Plan Mode

Plan mode restricts file mutations (Write, Edit, destructive Bash). Only 7 plan-safe agents spawn:
Mason, Hunter, Drew, Sage, Tessa, Paige, Reed.
The remaining 12 are deferred until plan mode exits.
