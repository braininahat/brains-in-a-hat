# brains-in-a-hat

**Lazy-spawned Claude Code agent team with closed-loop self-improvement, hybrid memory (harness-native per-repo + optional Obsidian-synced cross-repo vault), and multi-repo project constellations.**

[![Claude Code](https://img.shields.io/badge/Claude%20Code-2.1.178%2B-orange)](https://code.claude.com)
[![version](https://img.shields.io/badge/version-1.0.0--alpha-blue)](./brains-in-a-hat/.claude-plugin/plugin.json)
[![Experimental agent teams](https://img.shields.io/badge/agent%20teams-experimental-yellow)](https://code.claude.com/docs/en/agent-teams)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

```bash
claude plugins add github:braininahat/brains-in-a-hat
```

## Requirements

- **Claude Code ≥ 2.1.178** — this plugin targets implicit agent teams (`TeamCreate`/`TeamDelete` were removed from the harness at this version; earlier versions won't work with it).
- **`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`** set before you launch Claude Code — agent teams are still an experimental upstream feature. Add it to your shell rc, or to the `env` block of your Claude Code `settings.json`, so it's always set.
- **Recommended session model: opus.** Neal (the orchestrator) lives in the main thread for the whole session; routing quality and meta-analysis are where model quality compounds, and Neal himself is cheap regardless — strictly read + delegate, no code generation in the main thread. This is a recommendation, not something the plugin can enforce.
- **macOS/Linux only for now.** Windows is currently unsupported — only the `session-start` hook has a Windows-compatible wrapper today; the rest of the hook routing is Unix-shell-only. An issue tracks bringing the rest under the cross-platform wrapper.
- No vault, no extra setup, no account needed to get started — see [Quick start](#quick-start).

## Quick start

```bash
# 1. Install the plugin
claude plugins add github:braininahat/brains-in-a-hat

# 2. Set the experimental agent-teams flag (add to your shell rc to persist)
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

# 3. Open Claude Code in your repo. That's it.
```

There's no vault to set up, no `project.json` to write, no second env var. On your first prompt, Neal orients himself and the rest of the roster spawns **lazily** — the first time you ask for review, research, design, or implementation work, that specific teammate comes up and stays around for the rest of the session. This is called **vault-less mode**: the global memory layer (Dewey/the librarian) is simply off, and everything else — orchestration, review, research, architecture, implementation — works exactly the same. See [Optional: the global memory vault](#optional-the-global-memory-vault) if you later want cross-repo memory.

## What's inside

| Component | Count | Description |
|-----------|-------|-------------|
| Agents | 5 | Dewey (Librarian), Ebert (Critic), Marco (Scout), Wright (Architect — read-only), Ada/Grace/Shannon (Builders — on-demand, one `subagent_type`). Plus Neal in the main thread. All lazy — nobody is spawned until a matching intent arrives. |
| Commands | 1 | `/assemble` — the only command the user types, and it doesn't spawn anyone; it just (re-)adopts Neal's persona. Neal handles every other intent (review, ship, research, implement, design, recall) by routing internally. |
| Hooks | 8 | session bootstrap + per-turn context injection + idle-tick + a single merged lane-enforcement dispatcher + a SendMessage guard |
| Scripts | 2 | `vault-init.sh` (optional — bootstrap the global vault); `file-plugin-issue.sh` (file issues on the plugin repo from any project, exact-title deduped) |

## How it works

- **Neal** lives in the main thread and orchestrates. The user talks to Neal; Neal routes by intent (no CODEOWNERS, no file-pattern routing). Neal is strictly read + delegate — enforced by a single PreToolUse dispatcher keyed on the harness's own `agent_type` field, not marker files.
- **Every teammate is lazy.** Dewey/Ebert/Marco/Wright spawn the first time a matching intent arrives and are reused via `SendMessage` from then on — never re-spawned. A guard hook denies `SendMessage` to any name that isn't yet a live team member (with a spawn hint), which is what makes lazy spawning safe instead of risking the harness's silent-message-drop bug.
- **Memory is hybrid.** Per-repo learnings and preferences live in Claude Code's own per-project memory, auto-recalled with zero setup — Neal writes there directly. The vault is an **optional** second layer for anything cross-repo: shared learnings across a multi-repo constellation, decisions (ADRs), wiki concepts, a session journal, and a research cache. No vault configured → Dewey (the librarian) never spawns, the cache and journal are off, everything else is unaffected.
- **Critic / Builder / Scout / Architect** spawn on demand. Critic switches review lenses by prompt parameter (`lens=architecture|security|performance|ux|correctness|verification`); Builder reads the project's own `CLAUDE.md` for domain context; Scout routes between context7, web, and its own knowledge; Architect produces read-only design blueprints and audits (owns anything with no diff yet — once there's a diff, it's Critic's).
- A `SubagentStart` hook injects the last N main-thread turns, a session-derived roster block, and a pointer to the harness memory index into every teammate spawn, so you never have to manually push context.
- A `TeammateIdle` hook re-engages Dewey (when a vault exists) to classify new transcript turns, update the vault with curation logic (update/supersede/delete — not just append), and push — re-engaging via the sanctioned `exit 2` mechanism rather than an undocumented continuation flag.

## What makes it different

- **Lazy roster, not eager spawn** — nobody comes up until you actually need them; a guard hook makes that safe.
- **Hybrid memory, not vault-or-nothing** — per-repo memory works out of the box with zero setup; the vault only adds value once you're working across repos.
- **Not 21 role-specialists with file-path routing** — a handful of generalist teammates with intent-based dispatch. (Earlier iterations of this plugin actually shipped that fleet; the current design is what came out of retiring it.)
- **Not a write-only retro archive** — a curated vault that updates, supersedes, and deletes as you work, when you have one.
- **Not single-repo state** — project constellations that share context across all your repos, for vault users.
- **Not Obsidian-sync-dependent** — the vault is a git repo (e.g., a private GitHub repo); git is the sync primitive. Obsidian is an optional way to browse it, never a requirement.
- **Not a graph database server** — a flat-vault knowledge graph: markdown + YAML frontmatter + wikilinks + Dataview queries at read time. Zero infrastructure.

## Optional: the global memory vault

Skip this whole section if you only ever work in one repo at a time — per-repo memory already covers you. The vault is worth setting up once you want:

- Shared learnings across a **multi-repo constellation** (e.g., a model repo + a UI repo + a paper repo that should all see each other's decisions).
- A durable **decision log** (ADRs) and **wiki** that outlive any single repo's memory.
- A **session journal** and an auto-captured **research cache** shared across projects.

Because the plugin installs into Claude Code's own plugin cache rather than a path you chose, `vault-init.sh` doesn't live at a fixed location on your machine. Get to it one of two ways:

```bash
# Option A: find the installed plugin directory, then run its script
claude plugins list   # shows the install path for brains-in-a-hat
bash <that-path>/scripts/vault-init.sh auto

# Option B: just clone this repo and run it from there directly
git clone https://github.com/braininahat/brains-in-a-hat
bash brains-in-a-hat/brains-in-a-hat/scripts/vault-init.sh auto
```

`vault-init.sh detect` (or `auto`) figures out which case you're in — fresh init vs. an existing vault repo to clone. Then:

```bash
export BRAINS_VAULT_DIR=~/.hatbrains   # add to your shell rc to persist
```

With `BRAINS_VAULT_DIR` set and pointing at a git repo, Dewey spawns lazily the first time Neal needs to record or recall something at the global layer (a cross-repo learning, a decision, a journal entry), and the research cache turns on automatically. Without it — or if it's set but not actually a git repo — the plugin detects that on session start and simply never routes to Dewey. No errors, no degraded mode, no manual toggle needed.

### Multi-device & multi-repo (vault users only)

On a new device:

```bash
gh repo clone <you>/hatbrains-vault ~/.hatbrains
export BRAINS_VAULT_DIR=~/.hatbrains
```

Worktrees of the same repo share the same vault entries (logical project keying via `.brains_in_a_hat/project.json` → git remote → basename, in that order).

For multi-repo projects (e.g., a model repo + a UI repo + a paper repo), declare a shared `projectGroup` in each repo's `project.json`:

```json
{
  "projectGroup": "pulse",
  "repoKey": "pulse-model"
}
```

Cross-repo learnings then land in `<projectGroup>--shared--learnings.md` instead of being duplicated per repo. This only affects the optional vault layer — the per-repo hot memory layer is keyed automatically by Claude Code itself and needs no `project.json` at all.

### The vault, in one screenshot

Open Obsidian to the vault root and you see one `index.md` with Dataview-driven sections: **This week**, **Open threads**, **Recent decisions**, **Wiki entries**, **Group rollup**. No subdirectories — the whole knowledge graph is a flat directory of markdown files, holding only the global layer (shared learnings, decisions, wiki, journal, research cache) — per-repo learnings live in Claude Code's own memory, not here. Cross-references are `[[wikilinks]]`; structure is frontmatter (`type`, `projectGroup`, `repoKey`, `tags`, `status`).

## Documentation map

- [`brains-in-a-hat/CLAUDE.md`](./brains-in-a-hat/CLAUDE.md) — architecture and hook lifecycle (source of truth for behavior)
- [`brains-in-a-hat/agents/`](./brains-in-a-hat/agents/) — the five teammate persona files (librarian, critic, scout, architect, builder)
- [`brains-in-a-hat/hooks/README.md`](./brains-in-a-hat/hooks/README.md) — full hook file inventory and execution-order diagram
- [`brains-in-a-hat/hooks/neal-persona.md`](./brains-in-a-hat/hooks/neal-persona.md) — Neal's full prompt (orchestrator + meta-analyst)
- [`brains-in-a-hat/scripts/vault-init.sh`](./brains-in-a-hat/scripts/vault-init.sh) — optional vault bootstrap helper
- [`brains-in-a-hat/scripts/file-plugin-issue.sh`](./brains-in-a-hat/scripts/file-plugin-issue.sh) — file issues on the plugin repo from any project (used by Builders via `UPSTREAM-ISSUE-REQUEST:` sentinel)

## Recommended GitHub repo topics

If you fork this, set these topics for discoverability:

`claude-code`, `claude-code-plugin`, `claude-code-agents`, `agent-team`, `multi-agent`, `obsidian`, `obsidian-sync`, `ai-agents`, `agentic-ai`, `anthropic`, `self-improvement`, `external-memory`, `prompt-engineering`, `developer-tools`, `closed-loop-agents`.

## License

MIT.
