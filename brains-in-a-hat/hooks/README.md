# hooks/

Claude Code lifecycle hooks for the brains-in-a-hat plugin.

## File Inventory

| File | Purpose |
|------|---------|
| `hooks.json` | Hook wiring — maps all lifecycle events to their commands |
| `session-start` | SessionStart script — bootstraps vault/team dirs, starts dashboard, gathers project context, injects Neal persona |
| `first-prompt-greeting` | UserPromptSubmit script — consumes the greeting flag set by session-start and injects a one-time briefing prompt on the first user message |
| `neal-persona.md` | Neal's full system prompt — team roster, routing rules, model tiers, plan mode behaviour |
| `run-hook.cmd` | Cross-platform polyglot wrapper — lets hooks.json use a single command path on both Windows (cmd.exe) and Unix (bash) |

## Hook Execution Order

```
Session opens
    │
    ▼
SessionStart ──► session-start (via run-hook.cmd)
                   ├─ Starts dashboard server (non-blocking)
                   ├─ First-run: creates vault dirs, CODEOWNERS, Obsidian config
                   ├─ Writes greeting flag to /tmp/neal-greeting-<session_id>
                   ├─ Appends session record to ~/.brains_in_a_hat/active-sessions.jsonl
                   ├─ Loads neal-persona.md
                   ├─ Gathers: git state, backlog, memory, vault state, vault index,
                   │           CODEOWNERS, pending retro proposals
                   └─ Emits JSON { hookEventName, additionalContext } → injected into Neal's prompt

User sends first message
    │
    ▼
UserPromptSubmit ──► first-prompt-greeting
                       ├─ Checks for /tmp/neal-greeting-<session_id> flag
                       ├─ If present: removes flag, emits systemMessage asking Neal
                       │             to greet user and summarise session status (3-5 lines)
                       └─ If absent (subsequent messages): exits silently

Agent spawned
    │
    ▼
SubagentStart ──► (inline command, two steps)
                   ├─ Step 1: appends { ts, agent, event:"start" } to .brains_in_a_hat/state/activity.jsonl
                   └─ Step 2: injects shared protocols into every agent's context (see below)

Agent completes
    │
    ▼
SubagentStop ──► (inline command)
                  └─ Appends { ts, agent, event:"done" } to .brains_in_a_hat/state/activity.jsonl

Tool call: Agent
    │
    ▼
PostToolUse[Agent] ──► (inline command)
                         └─ Appends { ts, agent, event:"spawn", detail:<description> }
                            to .brains_in_a_hat/state/activity.jsonl

Tool call: Write
    │
    ▼
PreToolUse[Write] ──► (inline command)
                        └─ Blocks writes whose file_path is inside $CLAUDE_PLUGIN_ROOT
                           (prevents agents from modifying plugin files)

Session closes
    │
    ▼
SessionEnd ──► (inline command)
               └─ Emits additionalContext instructing Neal to spawn session-manager
                  (background, sonnet) to persist decisions, WIP, and vault updates
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
