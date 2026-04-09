# hooks/

Claude Code lifecycle hooks for the brains-in-a-hat plugin.

## File Inventory

| File | Purpose |
|------|---------|
| `hooks.json` | Hook wiring — maps all lifecycle events to their commands |
| `session-start` | SessionStart script — bootstraps vault/state dirs, starts dashboard, cleans stale state files. **No persona injection** — that happens via `/assemble` |
| `first-prompt-greeting` | UserPromptSubmit script — detects `/assemble` activation, refreshes skills caches, injects compaction-recovery breadcrumb + once-per-session missing-skills banner |
| `neal-persona.md` | Neal's full system prompt — team roster, routing rules, model tiers, plan mode behaviour |
| `run-hook.cmd` | Cross-platform polyglot wrapper — lets hooks.json use a single command path on both Windows (cmd.exe) and Unix (bash) |
| `inject-subagent-context` | SubagentStart script — emits PROTOCOLS block plus a precomputed per-agent suffix (RECOMMENDED SKILLS + inline workflow fallbacks for missing skills). Reads from `agent-ctx.cache` built by `refresh-skills-cache` |
| `refresh-skills-cache` | Scans installed skills once per session, writes three caches: `skills-available.cache`, `skills-missing.cache`, `agent-ctx.cache`. Session-scoped via PID marker |
| `update-session-state` | PostToolUse[Agent] script — appends spawned agent name to `session-state.json` under a directory-based lock (safe for concurrent sessions) |
| `enforce-neal-allowlist` | PreToolUse catch-all — enforces Neal's tool allowlist (Read, Grep, Glob, Agent, SendMessage, Task*, Team*, AskUserQuestion, mode tools, Skill, ToolSearch, plugin-infra Bash). Blocks everything else from parent session; subagents unrestricted |
| `block-team-lead-edits` | **DEPRECATED** — replaced by `enforce-neal-allowlist`. Kept for reference only |
| `pretool-agent-check` | PreToolUse[Agent] script — enforces sonnet ceiling (blocks opus for team members), advises model tier based on task keywords |
| `lib-common.sh` | Shared helpers (currently `detect_project_name` — resolves project name via gh or pwd basename) |

## Hook Execution Order

```
Session opens
    │
    ▼
SessionStart ──► session-start (via run-hook.cmd)
                   ├─ Starts dashboard server (non-blocking)
                   ├─ First-run: creates vault dirs, CODEOWNERS, Obsidian config
                   ├─ Cleans stale state: active.*, missing-shown.*, skills-cache-built.*,
                   │                     zellij-pane-*.id files whose PID is dead
                   ├─ Appends session record to ~/.brains_in_a_hat/active-sessions.jsonl
                   └─ No persona injection (bootstrap only)

User sends message (any prompt)
    │
    ▼
UserPromptSubmit ──► first-prompt-greeting
                       ├─ Detects /assemble — creates .brains_in_a_hat/state/active.<PID>
                       ├─ When team active: refreshes skills caches (once per session)
                       ├─ First prompt of session: emits missing-skills banner
                       │                          (if any expected skills missing)
                       └─ Every prompt: emits compaction-recovery breadcrumb as
                                        systemMessage (points to neal-persona.md
                                        and session-state.json for recovery)

Agent spawned
    │
    ▼
SubagentStart ──► (three steps)
                   ├─ Step 1: appends { ts, agent, session, event:"start" } to activity.jsonl
                   ├─ Step 2: (Zellij) opens floating pane tailing agent's activity entries
                   │          (pane-id file scoped by session PID)
                   └─ Step 3: inject-subagent-context — emits PROTOCOLS + precomputed suffix
                              (RECOMMENDED SKILLS + inline fallbacks for missing workflow skills)

Agent completes
    │
    ▼
SubagentStop ──► (two steps)
                  ├─ Step 1: appends { ts, agent, session, event:"done" } to activity.jsonl
                  └─ Step 2: (Zellij) renames pane to "<Agent> [done]", removes pane-id file

Tool call: Agent
    │
    ▼
PostToolUse[Agent] ──► (two steps)
                         ├─ Step 1: appends { ts, agent, session, event:"spawn", detail } to activity.jsonl
                         └─ Step 2: update-session-state — locks & updates spawned_agents
                                    in session-state.json

Any tool call
    │
    ▼
PreToolUse[*] ──► enforce-neal-allowlist
                   └─ Checks parent session against allowlist (Read, Grep, Glob,
                      Agent, SendMessage, Task*, Team*, AskUserQuestion, mode tools,
                      ToolSearch, Skill, plugin-infra Bash). Blocks everything else.
                      Subagents pass through freely.

PreToolUse[Write] ──► (plugin-file guard)
                        └─ Blocks writes whose file_path is inside $CLAUDE_PLUGIN_ROOT
                           (prevents agents from modifying plugin files)

Session closes
    │
    ▼
SessionEnd ──► (inline command)
               └─ Emits additionalContext instructing Neal to:
                  (1) SendMessage Gale to finalize session chapter and compile PDF
                  (2) Spawn session-manager (background, sonnet) to persist state
```

## Shared Protocols (injected at SubagentStart)

Every agent receives these protocols at spawn time via the SubagentStart hook:

**Activity Reporting**
Log key moments to `.brains_in_a_hat/state/activity.jsonl` using `jq -nc`. Event types: `start`, `read`, `finding`, `message`, `done`. Keep to 3–6 events per task.

**Code Navigation**
Prefer LSP (Pyright) over Grep/Read for Python — 5–20x more token efficient.

**Communication**
Report findings to Neal via SendMessage. You may also message teammates directly by name. Never interact with the user directly.

**Team Context**
You are part of team `hatbrains`. Check TaskList for assigned tasks. Use TaskUpdate to claim tasks (set owner to your name) and mark them completed. Message teammates by name via SendMessage when you need their input.

**Startup**
If no tasks are assigned to you, idle silently. Do NOT message Neal to announce yourself — wait for work.

**Domain Context**
Read `.brains_in_a_hat/domain-config.json` if it exists for project-specific terminology, compliance rules, and patterns.

**Vault Persistence**
If `~/.brains_in_a_hat/vault/` exists, persist durable artifacts (findings, decisions, reviews, designs) using templates from `$CLAUDE_PLUGIN_ROOT/vault-templates/`. Use Dataview frontmatter (`type`, `project`, `agents`, `date`, `tags`, `status`) and `[[wikilinks]]`. Write to `~/.brains_in_a_hat/vault/projects/<project-name>/` (flat — files categorized by `type:` frontmatter, not subdirectories). Read the relevant template before writing.
