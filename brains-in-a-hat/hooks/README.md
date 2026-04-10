# hooks/

Claude Code lifecycle hooks for the brains-in-a-hat plugin.

## File Inventory

| File | Purpose |
|------|---------|
| `hooks.json` | Hook wiring — maps all lifecycle events to their commands |
| `session-start` | SessionStart script — bootstraps vault/state dirs, starts dashboard, cleans stale state files, and (if `source==compact`) writes the compact-pending marker so the recovery banner fires on the next prompt. **No persona injection** — that happens via `/assemble` |
| `first-prompt-greeting` | UserPromptSubmit script — detects `/assemble` activation, refreshes skills caches, injects the `gather-context` briefing as `additionalContext` on /assemble (one-shot), emits `COMPACTION RECOVERY` systemMessage when `compact-pending.<sid>` exists, emits `RETRO DUE` instruction when `retro-pending.<sid>` exists (checkpoint or final), emits `POST-MORTEM DUE` instruction when `session-end-snapshot.json` exists from a prior session, and injects `CURRENT FOCUS: <value>` on every prompt when team is active |
| `neal-persona.md` | Neal's full system prompt — team roster, routing rules, model tiers, plan mode behaviour |
| `run-hook.cmd` | Cross-platform polyglot wrapper — lets hooks.json use a single command path on both Windows (cmd.exe) and Unix (bash) |
| `gather-context` | Session-context aggregator — runs at /assemble via `first-prompt-greeting`. Outputs the project briefing (git state, backlog, memory, vault state, CODEOWNERS, pending proposals) |
| `inject-subagent-context` | SubagentStart script — emits PROTOCOLS block plus a precomputed per-agent suffix (RECOMMENDED SKILLS + inline workflow fallbacks for missing skills). Reads from `agent-ctx.cache` built by `refresh-skills-cache` |
| `refresh-skills-cache` | Scans installed skills once per session, writes three caches: `skills-available.cache`, `skills-missing.cache`, `agent-ctx.cache`. Session-scoped via PID marker |
| `update-session-state` | PostToolUse[Agent] script — appends spawned agent name to `session-state.json` under a directory-based lock (safe for concurrent sessions) |
| `enforce-neal-allowlist` | PreToolUse catch-all — enforces Neal's tool allowlist (Read, Grep, Glob, LS, Agent, SendMessage, Task*, Team*, AskUserQuestion, mode tools, Skill, ToolSearch, plugin-infra Bash, curated read-only Bash — `gh list/view/api/search`, `git log/status/diff/show/blame/config --get`, `ls`, `cat`, `head`, `tail`, `wc`, `file`, `pwd`, `whoami`, `date` — with shell metacharacters rejected). Subagents bypass the allowlist via `.brains_in_a_hat/state/in-subagent.*` marker files written by `SubagentStart` and removed by `SubagentStop` |
| `pretool-agent-check` | PreToolUse[Agent] script — enforces sonnet ceiling (blocks opus for team members), advises model tier based on task keywords, runs vault-check which emits an **advisory** `VAULT HINT` as `hookSpecificOutput.additionalContext` (not a hard block) when prior research matches, with `[vault-reviewed]` bypass |
| `record-decision` | Helper called by Reed (session-manager) via Bash allowlist — persists decisions to `session-state.json.decisions` under a directory lock |
| `lib-common.sh` | Shared helpers (currently `detect_project_name` — resolves project name via gh or pwd basename) |

## Hook Execution Order

```
Session opens
    │
    ▼
SessionStart ──► session-start (via run-hook.cmd)
                   ├─ Starts dashboard server (non-blocking)
                   ├─ First-run: creates vault dirs, CODEOWNERS, Obsidian config
                   ├─ Cleans stale state: active.*, missing-shown.*,
                   │                     skills-cache-built.*,
                   │                     gather-context-emitted.*,
                   │                     post-mortem-emitted.*,
                   │                     compact-pending.* (mismatched),
                   │                     in-subagent.* (all),
                   │                     retro.lock.d, session-state.json.lock.d
                   ├─ If source==compact, writes compact-pending.<sid>
                   │  so first-prompt-greeting will emit the recovery banner
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
                       ├─ On /assemble (one-shot): runs gather-context and
                       │                injects the full session briefing as
                       │                additionalContext (includes missing-skills
                       │                banner if any)
                       └─ Post-compaction only: emits COMPACTION RECOVERY systemMessage
                                          (gated by compact-pending.<sid> marker
                                          written by PreCompact hook or by
                                          session-start on source==compact)

Conversation about to be compacted
    │
    ▼
PreCompact ──► (inline command)
                └─ Writes .brains_in_a_hat/state/compact-pending.<session_id>
                   so first-prompt-greeting emits the COMPACTION RECOVERY
                   banner on the next user prompt after compaction completes.

Agent spawned
    │
    ▼
SubagentStart ──► (three steps)
                   ├─ Step 1: appends { ts, agent, session, event:"start" } to activity.jsonl
                   ├─ Step 2: inject-subagent-context — emits PROTOCOLS + SHARED CONTEXT
                   │          (curated by Gale, read from session-state.json) + precomputed
                   │          suffix (RECOMMENDED SKILLS + inline fallbacks)
                   └─ Step 3: writes .brains_in_a_hat/state/in-subagent.<id>
                              (used by enforce-neal-allowlist to detect subagent context)

Agent completes
    │
    ▼
SubagentStop ──► (two steps)
                  ├─ Step 1: appends { ts, agent, session, event:"done" } to activity.jsonl
                  └─ Step 2: removes .brains_in_a_hat/state/in-subagent.<id>

Tool call: Agent
    │
    ▼
PostToolUse[Agent] ──► (three steps)
                         ├─ Step 1: appends { ts, agent, session, event:"spawn", detail } to activity.jsonl
                         ├─ Step 2: update-session-state — locks & updates spawned_agents
                         │          in session-state.json
                         └─ Step 3: prompts Neal to SendMessage Gale with findings (skipped for Gale itself)

Any tool call
    │
    ▼
PreToolUse[*] ──► enforce-neal-allowlist
                   ├─ If any .brains_in_a_hat/state/in-subagent.* marker exists,
                   │  exit 0 — caller is inside a subagent, allowed everything.
                   └─ Otherwise (parent session / Neal): checks the tool against
                      the allowlist (Read, Grep, Glob, LS, Agent, SendMessage,
                      Task*, Team*, AskUserQuestion, mode tools, ToolSearch,
                      Skill, plugin-infra Bash, curated read-only Bash). Blocks
                      the rest with a routing suggestion.

PreToolUse[Write] ──► (plugin-file guard)
                        └─ Blocks writes whose file_path is inside $CLAUDE_PLUGIN_ROOT
                           (prevents agents from modifying plugin files)

PreToolUse[Agent] ──► pretool-agent-check
                        ├─ Enforces sonnet ceiling (blocks opus for team members)
                        ├─ Runs vault-check — blocks spawn if prior research exists
                        │  in the vault and the prompt lacks [vault-reviewed] marker
                        │  (exempts brains-in-a-hat: team members)
                        └─ Advises model tier based on task keywords

Session closes
    │
    ▼
SessionEnd ──► (inline command)
               ├─ Writes retro-pending.<sid>="final" marker
               ├─ Copies session-state.json → session-end-snapshot.json (safety net)
               └─ Emits additionalContext instructing Neal to spawn ALL THREE in parallel
                  (fire-and-exit, do NOT wait):
                  (1) SendMessage(to=Gale) to finalize session chapter + compile PDF
                  (2) Agent(Mira, mode=final) for the retrospective
                  (3) Agent(Reed, mode=persist) for decision promotion + preferences only
                  (Reed no longer writes retros — that's Mira's job; duplication removed)
```

## Compaction detection

`PreCompact` fires before Claude Code compacts the conversation. The hook writes
TWO markers: `.brains_in_a_hat/state/compact-pending.<session_id>` and
`.brains_in_a_hat/state/retro-pending.<session_id>` containing `checkpoint`.
On the next user prompt, `first-prompt-greeting` emits the COMPACTION RECOVERY
systemMessage AND a RETRO DUE instruction, deleting both markers as one-shots.
Belt + suspenders: `session-start` also writes `compact-pending` if its
`source` field is `compact` — covers auto-compact cases where the PreCompact
hook may not have fired cleanly.

## Retro triggers

Two retro events fire automatically:

- **Checkpoint retro** — `PreCompact` writes `retro-pending.<sid>="checkpoint"`.
  After compaction, `first-prompt-greeting` instructs Neal to spawn Mira in
  `mode=checkpoint`. Mira reads session-state.json, activity.jsonl, and the
  session-log in vault (all survive compaction), writes a condensed retro,
  does NOT touch CODEOWNERS/patterns.md/workflow.md.
- **Final retro** — `SessionEnd` writes `retro-pending.<sid>="final"` and
  instructs Neal to spawn Mira in `mode=final` (full retro with all
  maintenance) in parallel with Reed(mode=persist) and Gale-finalize.

A concurrency guard at `.brains_in_a_hat/state/retro.lock.d` (directory lock)
prevents overlapping retro runs — if a second retro fires while the first is
still writing, the second exits cleanly. `session-start` clears the lock as a
safety net on every boot.

## Session-end snapshot + post-mortem detection

`SessionEnd` copies `session-state.json` to `session-end-snapshot.json` as a
durable safety net. If the previous session ended without Neal actioning the
SessionEnd fanout (race: Neal may not have had a turn between the hook firing
and the session terminating), the snapshot survives. On the next session's
first prompt, `first-prompt-greeting` detects the snapshot and emits a
`POST-MORTEM DUE` systemMessage instructing Neal to spawn Reed in `mode=persist`
to process it. Reed is expected to delete the snapshot after processing.
A PID-keyed `post-mortem-emitted.<PID>` marker prevents the banner from
re-firing within the same session.

## Subagent context detection

`SubagentStart` writes `.brains_in_a_hat/state/in-subagent.<id>` — one file
per active subagent, keyed by `agent_id` (or falling back to `agent_type`).
Parallel subagents produce multiple markers. `SubagentStop` removes the
marker. `enforce-neal-allowlist` uses glob existence
(`ls .brains_in_a_hat/state/in-subagent.* &>/dev/null`) as the
"am I inside a subagent?" signal. Stale markers are wiped by `session-start`
on every session boot (no subagents can be running at that point).

This replaces the prior `transcript_path` regex, which was dead code:
Claude Code's PreToolUse hook input passes the PARENT session's transcript
path, so `/subagents/agent-` never matched in practice. The allowlist was
silently applying to every tool call regardless of subagent context.

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
If `~/.brains_in_a_hat/vault/` exists, persist durable artifacts (findings, decisions, reviews, designs) using templates from `$CLAUDE_PLUGIN_ROOT/vault-templates/`. Use Dataview frontmatter (`type`, `project`, `agents`, `date`, `tags`, `status`) and `[[wikilinks]]`. Write to `~/.brains_in_a_hat/vault/` root — all notes flat, categorized by `type:` and `project:` properties. Images go in `attachments/`. Read the relevant template before writing.
