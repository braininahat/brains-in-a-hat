# brains-in-a-hat

**5-agent Claude Code team with closed-loop self-improvement, Obsidian-synced external memory, multi-repo project constellations.**

[![Claude Code](https://img.shields.io/badge/Claude%20Code-2.1.32%2B-orange)](https://code.claude.com)
[![version](https://img.shields.io/badge/version-1.0.0--alpha-blue)](./brains-in-a-hat/.claude-plugin/plugin.json)
[![Experimental agent teams](https://img.shields.io/badge/agent%20teams-experimental-yellow)](https://code.claude.com/docs/en/agent-teams)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

```bash
claude plugins add github:braininahat/brains-in-a-hat
```

## Quick start

```bash
# 1. Install the plugin
claude plugins add github:braininahat/brains-in-a-hat

# 2. Bootstrap your vault (one-time, per device)
bash brains-in-a-hat/scripts/vault-init.sh auto

# 3. Set the env var (add to your shell rc to persist)
export BRAINS_VAULT_DIR=~/.hatbrains

# 4. (Optional) Group a multi-repo project — drop this in each repo:
cat > .brains_in_a_hat/project.json <<EOF
{
  "projectGroup": "pulse",
  "repoKey": "pulse-model"
}
EOF

# 5. Open Claude Code in the repo. The new-roster-bootstrap hook auto-spawns
#    Librarian on your first prompt. That's it.
```

## What's inside

| Component | Count | Description |
|-----------|-------|-------------|
| Agents | 4 | Librarian, Critic, Builder, Scout (plus Neal in the main thread) |
| Commands | 2 | `/review` (Critic with lens param), `/ship` |
| Hooks | 6 | session bootstrap + per-turn context injection + idle-tick + allowlist enforcement |
| Scripts | 1 | `vault-init.sh` (detect/init/clone vault repo) |

## How it works

- **Neal** lives in the main thread and orchestrates. The user talks to Neal; Neal routes by intent (no CODEOWNERS, no file-pattern routing).
- **Librarian** is an always-on teammate that curates a flat-vault knowledge graph in your private vault repo. It pulls/commits/pushes on every TeammateIdle tick — multi-device sync via git, no Obsidian sync required.
- **Critic / Builder / Scout** spawn on demand. Critic switches review lenses by prompt parameter (`lens=architecture|security|performance|ux|correctness`); Builder reads project CLAUDE.md for domain context; Scout routes between context7, web, and own knowledge.
- A `SubagentStart` hook injects the last N main-thread turns + active learnings into every teammate spawn, so you never have to manually push context.
- A `TeammateIdle` hook re-engages Librarian to classify new transcript turns, update the vault with curation logic (update/supersede/delete — not just append), and push.

## What makes it different

- **Not 21 role-specialists with file-path routing** — 5 generalist teammates with intent-based dispatch.
- **Not a write-only retro archive** — a curated vault that updates, supersedes, and deletes as you work.
- **Not single-repo state** — project constellations that share context across all your repos.
- **Not Obsidian-sync-dependent** — the vault is a git repo (e.g., a private GitHub repo); git is the sync primitive.
- **Not a graph database server** — a flat-vault knowledge graph: markdown + YAML frontmatter + wikilinks + Dataview queries at read time. Zero infrastructure.

## Multi-device & multi-repo

The vault (`$BRAINS_VAULT_DIR`, default `~/.hatbrains`) is a private git repo. On a new device:

```bash
gh repo clone <you>/hatbrains-vault ~/.hatbrains
export BRAINS_VAULT_DIR=~/.hatbrains
```

`vault-init.sh detect` (or `auto`) figures out which case you're in (fresh init vs clone existing).

Worktrees of the same repo share the same vault entries (logical project keying via `.brains_in_a_hat/project.json` → git remote → basename, in that order).

For multi-repo projects (e.g., PULSE = model + UI + paper), declare a shared `projectGroup` in each repo's `project.json`. Cross-repo learnings land in `<projectGroup>--shared--learnings.md`.

## The vault, in one screenshot

Open Obsidian to the vault root and you see one `index.md` with Dataview-driven sections: **Active now**, **This week**, **Open threads**, **Recent decisions**, **Wiki entries**, **Group rollup**. No subdirectories — the whole knowledge graph is a flat directory of markdown files. Cross-references are `[[wikilinks]]`; structure is frontmatter (`type`, `projectGroup`, `repoKey`, `tags`, `status`).

## Documentation map

- [`brains-in-a-hat/CLAUDE.md`](./brains-in-a-hat/CLAUDE.md) — architecture and hook lifecycle (source of truth for behavior)
- [`brains-in-a-hat/agents/`](./brains-in-a-hat/agents/) — the four teammate persona files
- [`brains-in-a-hat/hooks/neal-persona.md`](./brains-in-a-hat/hooks/neal-persona.md) — Neal's full prompt (orchestrator + meta-analyst)
- [`brains-in-a-hat/scripts/vault-init.sh`](./brains-in-a-hat/scripts/vault-init.sh) — vault bootstrap helper

## Recommended GitHub repo topics

If you fork this, set these topics for discoverability:

`claude-code`, `claude-code-plugin`, `claude-code-agents`, `agent-team`, `multi-agent`, `obsidian`, `obsidian-sync`, `ai-agents`, `agentic-ai`, `anthropic`, `self-improvement`, `external-memory`, `prompt-engineering`, `developer-tools`, `closed-loop-agents`.

## License

MIT.
