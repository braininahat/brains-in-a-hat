# brains-in-a-hat

A marketplace of Claude Code plugins built around **Neal and the 21-agent hatbrains team** — plus tooling for scientific visualization (`archer`) and local-LLM delegation (`minion`).

![hatbrains team banner placeholder](./docs/img/banner.png)
<!-- Screenshot: Neal greeting after /assemble, showing the team roster + session briefing panel in a Claude Code terminal. -->

## Plugins

| Plugin | Version | Purpose |
|--------|---------|---------|
| [`brains-in-a-hat`](./brains-in-a-hat) | 0.6.x | 21-agent software team with per-project state, vault persistence, and compaction-resilient session memory |
| [`archer`](./archer) | 0.1.x | Publication-quality figures — fletcher ML architecture diagrams, TikZ rendering, Typst reports |
| [`minion`](./minion) | 1.0.x | Local-LLM delegation — Opus plans, Devstral executes. MCP server auto-spawns with optimal config |

All three live in a single marketplace (`.claude-plugin/marketplace.json`). Install any combination.

## Install

### Via marketplace (recommended)

```bash
# Inside Claude Code
/plugin marketplace add https://github.com/braininahat/brains-in-a-hat
/plugin install brains-in-a-hat
/plugin install archer           # optional
/plugin install minion           # optional
```

### Manual / development install

```bash
git clone https://github.com/braininahat/brains-in-a-hat ~/repos/personal/brains-in-a-hat
cd ~/repos/personal/brains-in-a-hat

# Symlink each plugin into ~/.claude/plugins/ (or use claude plugins add <path>)
ln -s $PWD/brains-in-a-hat  ~/.claude/plugins/brains-in-a-hat
ln -s $PWD/archer           ~/.claude/plugins/archer
ln -s $PWD/minion           ~/.claude/plugins/minion
```

### Requirements

- **Claude Code** (any recent version with Agent/TeamCreate/SendMessage tools)
- **`gh` CLI** authenticated (`gh auth login`) — used for project keying and issue/PR workflows
- **`jq`** — used throughout the hooks
- **A git repo** — brains-in-a-hat keys state and vault files by `<owner>-<name>` from `gh repo view`. Non-version-controlled directories are not a supported target.

## Quick start — brains-in-a-hat

First time in a project: type `/assemble` once to bootstrap the team. After that, **Neal auto-greets on every subsequent session** — the `SessionStart` hook detects prior team state (vault session log or index note for this project) and injects a status greeting via `systemMessage` + auto-activates team mode.

```
/assemble       # first time only — bootstraps team for a new project
```

Subsequent sessions automatically open with:

```
🎩 Neal here — back on brains-in-a-hat (feat/per-key-state-vault, 3 dirty). Last focus: fix OAuth. What's up?
```

![auto-greet screenshot placeholder](./docs/img/auto-greet.png)
<!-- Screenshot: fresh Claude Code session open, showing Neal's systemMessage greeting line immediately at the top of the conversation — before any user input. -->

Neal (chief of staff) is now your team lead. He reads, routes, and delegates — but never writes code himself. Ask him anything:

```
> review the auth middleware for security issues
```

Neal spawns `Chase` (qa-engineer), `Mason` (architect), and `Sage` (domain-expert) in parallel and relays their findings.

```
> file an issue for the regression Chase just found
```

Neal messages `Parker` (project-manager) who creates a labeled GitHub issue.

![agent roster screenshot placeholder](./docs/img/team-roster.png)
<!-- Screenshot: the 21 team members in a roster table — Gale, Mason, Tabitha, Porter, Paige, Sage, Sterling, Mira, Nolan, Cooper, Blaze, Chase, Quinn, Hunter, Reed, Melody, Drew, Tessa, Parker, Iris, Journey — with their current model and pending task counts. -->

## Team roster

21 specialists, each with a distinct persona, domain, and spawn-time skill suffix:

| Name | Role | Domain |
|------|------|--------|
| **Gale** | scribe | Session log, vault index maintenance, shared-context curator |
| **Mason** | architect | Structural boundaries, dependencies, code review |
| **Tabitha** | data-schema | Schemas, migrations, data formats |
| **Porter** | devops | CI/CD, GitHub Actions, releases |
| **Paige** | docs-writer | Docs, specs, CLAUDE.md maintenance |
| **Sage** | domain-expert | Domain logic, compliance, terminology |
| **Sterling** | hardware-device | USB, serial, WiFi, cameras, ADB |
| **Mira** | meta-retro | Retrospectives, CODEOWNERS maintenance, self-improvement |
| **Nolan** | mlops | Model loading, inference, optimization |
| **Cooper** | packaging | Docker, bundles, installers |
| **Blaze** | profiler | Latency, memory, throughput |
| **Chase** | qa-engineer | Tests, syntax, regressions (advisory only) |
| **Quinn** | qt-qml | Qt, QML, PySide6 |
| **Hunter** | researcher | Technical investigation, web research, comparisons |
| **Reed** | session-manager | Briefings, decision persistence |
| **Melody** | signal-processing | Audio, video, streaming, sync |
| **Drew** | system-designer | Blueprints, interfaces, tradeoffs |
| **Tessa** | testing-strategy | Test planning, coverage gaps |
| **Parker** | project-manager | Issues, backlog, milestones, GitHub Projects |
| **Iris** | ui-reviewer | Visual consistency, layout, theming |
| **Journey** | ux-workflow | User flows, states, transitions |

Neal spawns each on demand (except Gale, who is kept alive for the whole session to curate shared context).

## What runs automatically

Hooks fire on Claude Code lifecycle events; you only ever type `/assemble`. Everything else is automated:

| Event | What happens |
|-------|--------------|
| `SessionStart` | Computes project KEY from `gh`, writes `~/.brains_in_a_hat/sessions/<SID>.key`, bootstraps per-key state dir, caches team name |
| `UserPromptSubmit` | On `/assemble`: runs `gather-context` and injects full session briefing. Every prompt: injects `CURRENT FOCUS` for pivot detection |
| `SubagentStart` | Emits PROTOCOLS block with absolute paths + KEY + SHARED CONTEXT (curated by Gale) to every spawned agent |
| `PreCompact` | Writes `compact-pending.<SID>` + `retro-pending.<SID>=checkpoint`. First prompt after compaction emits `COMPACTION RECOVERY` banner and `RETRO DUE` instruction |
| `SessionEnd` | Writes `retro-pending.<SID>=final`, snapshots `session-state.json`, instructs Neal to spawn Mira (retro) + Reed (persistence) + Gale (finalize) in parallel |
| `PostToolUse[Agent]` | Logs spawn to `activity.jsonl`, updates `session-state.json`, nudges Neal to relay findings to Gale |
| `PreToolUse` | Enforces Neal's tool allowlist (read/delegate/task only); subagents bypass via `in-subagent.*` markers |

## State layout

`brains-in-a-hat` v0.7+ uses per-project keyed state:

```
~/.brains_in_a_hat/
├── state/
│   └── <owner>-<name>/                 # per-project runtime state
│       ├── session-state.json          # shared team context
│       ├── session-state.json.lock.d/  # atomic update lock
│       ├── activity.jsonl              # agent spawn/finding timeline
│       ├── session-end-snapshot.json   # SessionEnd safety net
│       ├── active.<SID>                # team-active marker
│       ├── cwd.<SID>                   # disambiguates worktrees
│       ├── retro-pending.<SID>, compact-pending.<SID>
│       ├── in-subagent.<id>            # subagent detection
│       ├── agent-ctx.cache, skills-*.cache
│       └── team-name, pm-tier, last-retro.md
├── sessions/
│   └── <SID>.key                       # SID → key lookup, written by SessionStart
└── vault/                              # flat Obsidian-compatible vault
    ├── <owner>-<name>--session-log.md
    ├── <owner>-<name>--patterns.md
    ├── <owner>-<name>--retro-<date>.md
    ├── <owner>-<name>--decision-<slug>.md
    ├── <owner>-<name>--wiki-<slug>.md
    ├── <owner>-<name>--index.md        # per-project markdown index auto-maintained by Gale
    ├── attachments/                    # shared images
    └── .obsidian/
```

`<owner>-<name>` comes from `gh repo view --json owner,name`. Two checkouts of the same repo share state (same key); two different repos with the same short name get distinct keys (e.g., `braininahat-cerebro` vs `ESC-Group-UB-cerebro`). Worktree disambiguation is automatic: if a different cwd is already active under the same key, a 6-char hash suffix is appended.

In-tree `.brains_in_a_hat/` holds only committable code:

```
<project>/.brains_in_a_hat/
├── CODEOWNERS              # agent ownership mappings (Mira maintains)
├── domain-config.json      # domain terminology, compliance rules (optional)
├── user-preferences.json   # Reed updates this with observed preferences
├── workflow.md             # Mira's meta-analysis of routing patterns (optional)
└── .gitignore
```

![vault in Obsidian placeholder](./docs/img/vault-obsidian.png)
<!-- Screenshot: Obsidian opened on ~/.brains_in_a_hat/vault/ showing the flat layout with <key>--index.md notes and their backlinks panel. -->

## Configuration

### CODEOWNERS

Auto-generated at first run in `.brains_in_a_hat/CODEOWNERS`. Mira updates it during retrospectives as new file types appear. Maps glob patterns to agent roles:

```
*.qml                qt-qml
*.py                 architect
Dockerfile           packaging
.github/             devops
tests/               testing-strategy
```

### Domain config

Copy `brains-in-a-hat/examples/domain-config.json` to `<project>/.brains_in_a_hat/domain-config.json` and customize. Sage (domain-expert) reads this for project-specific terminology and compliance checks.

### User preferences

`.brains_in_a_hat/user-preferences.json` — Reed observes workflow patterns and updates this over time. Controls communication style, tool preferences, engineering principles.

## Quick start — archer

Publication-quality scientific figures. Spawned on demand when Claude Code sees a visualization request.

```
> draw a diagram of the BiGRU-CTC architecture

# archer routes to:
#   - fletcher (Typst) for component-based ML diagrams
#   - TikZ / PetarV nn-diagram for neural network figures
#   - matplotlib/plotly for training curves, confusion matrices
#   - Typst for mixed-diagram reports
```

See [`archer/README.md`](./archer/README.md) for details.

## Quick start — minion

Delegate code generation to a local 24B Devstral model via MCP. Opus plans, Devstral executes.

```
> /minion refactor the OAuth flow to use JWT
```

minion auto-spawns `ik_llama.cpp` with an IQ4_NL quant on your GPU, exposes it as an MCP tool, and Claude calls `ask_devstral_agent` with a multi-turn code-gen budget.

See [`minion/README.md`](./minion/README.md) for configuration.

## Cross-device / cross-account

- **Plugins** live in a git repo — clone and install on any device with Claude Code.
- **Project config** (`CODEOWNERS`, `domain-config.json`, `user-preferences.json`) stays in-tree — version-controlled with the project.
- **Runtime state** (`~/.brains_in_a_hat/state/<key>/`) is per-device, not synced.
- **Vault** (`~/.brains_in_a_hat/vault/`) can be synced via Syncthing / git / iCloud — flat layout with key-prefixed filenames survives cloud sync intact (no symlinks).

## License

MIT
