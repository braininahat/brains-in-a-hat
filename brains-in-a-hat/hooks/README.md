# hooks/

Claude Code lifecycle hooks for the brains-in-a-hat plugin (v1.0.0-alpha).

Requires Claude Code ≥ 2.1.178 and `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (implicit agent teams — see repo root [`README.md`](../../README.md)). There is no `TeamCreate`/`TeamDelete` anywhere in this directory: every session gets one implicit team at `~/.claude/teams/session-<first 8 hex of session_id>/config.json`, and hooks read that path directly when they need the roster.

## File Inventory

| File | Purpose |
|------|---------|
| `hooks.json` | Hook wiring — maps all lifecycle events to their handler commands. Every command wraps `mkdir -p .brains_in_a_hat/state 2>/dev/null` **before** its own stderr redirect, so a brand-new repo (no state dir yet) can't deadlock the first hook call on a failing redirect. |
| `lib-common.sh` | Shared helpers: `derive_project_key`, `derive_project_group`, `_project_json_get`, `vault_is_git_repo`, vault path resolution (`$BRAINS_VAULT_DIR` → legacy `$VAULT_DIR` → `~/.hatbrains` default) |
| `lib-research.sh` | Research-cache helpers: `research_cache_dir`, `_sha256`, `classify_research_type`, `normalize_query`, `compute_cache_key`, `cache_shorthash`, `cache_path_for`, `ttl_for_type`, `is_stale`, `find_cache_hit`, `read_cache_field` |
| `neal-persona.md` | Neal's full system prompt — lazy-spawn roster with real names (Dewey/Ebert/Marco/Wright + Ada/Grace/Shannon builders), routing rules, architect boundary (diff→Ebert, no diff→Wright), builder model tiers, cache-first retrieval, `RECORD-REQUEST`/`UPSTREAM-ISSUE-REQUEST` sentinels, peer agency, meta-analysis |
| `run-hook.cmd` | Cross-platform polyglot wrapper. Today it only wraps `session-start` — the rest of this directory's hooks are Unix shell scripts with no Windows path. **Windows is currently unsupported**; an issue tracks bringing the other hooks under `run-hook.cmd`. |
| `session-start` | `SessionStart` — bootstraps `.brains_in_a_hat/state/`, reaps stale markers by age (no longer by `kill -0` on a session UUID, which never matched a PID), writes `.brains_in_a_hat/.gitignore` if absent, and records resume/compact recovery state for `new-roster-bootstrap` to surface |
| `new-roster-bootstrap` | `UserPromptSubmit` — on first prompt of session: checks the kill switch (`BRAINS_DISABLED=1` or `.brains_in_a_hat/project.json` `{"disabled":true}`) and no-ops entirely if set; otherwise emits Neal's lazy-roster orientation (spawn on first matching intent, reuse via `SendMessage` thereafter — no eager singleton spawn), preflights the vault (`vault_is_git_repo`) and notes vault-less mode when absent, emits a resume/compaction recovery banner when the prior-session marker says so, and nudges Neal to wake Dewey when `librarian-tick`'s cursor shows an unprocessed backlog |
| `inject-context` | `SubagentStart` — injects a main-thread transcript slice, a session-derived `ROSTER` block, and a `MEMORY.md`-index pointer into every teammate spawn |
| `librarian-tick` | `TeammateIdle` (Dewey/Librarian only) — re-engages Dewey via `exit 2` + a stderr prompt; cursor keyed by transcript-path hash (not session id), with a cross-transcript sweep for backlog left over from a prior session; accepts a NOOP receipt file when there's nothing to record, instead of forcing an empty commit |
| `enforce-lanes` | `PreToolUse` (all calls) — the single dispatcher replacing the old `enforce-neal-allowlist` + `enforce-teammate-lanes` pair. Keys on the **per-call** `agent_type` field: empty ⇒ Neal's read+delegate allowlist; non-empty ⇒ the role's write lane. No marker files. |
| `guard-sendmessage` | `PreToolUse[SendMessage]` — denies a message to any recipient not currently a member of the session's implicit team, with a "spawn it first via `Agent(name=...)`" hint. This is what makes lazy spawning safe (see below). |
| `capture-research` | `PostToolUse` (WebSearch, WebFetch, context7) — auto-captures results as content-addressed vault markdown (`research-cache--<subtype>--<shorthash>.md`); gated on `vault_is_git_repo` (no-ops entirely in vault-less mode); atomic tmp→mv write; skips empty/<200B/HTTP-4xx |
| `vault-check` | `PreToolUse` (WebSearch, WebFetch, context7) — advisory only, never blocks; gated on `vault_is_git_repo`; on cache hit emits `VAULT HINT [FRESH\|STALE]` via `hookSpecificOutput.additionalContext`; `[vault-reviewed]` suppresses |

## Why `enforce-lanes` replaced two hooks and all the marker files

The old design used `state/in-subagent.<id>` marker files, written by `SubagentStart` and removed by `SubagentStop`, as a proxy for "am I inside a subagent right now?" That was unnecessary: Claude Code's `PreToolUse`/`PostToolUse` payload already carries `agent_type` (and `agent_id`) on every call made by a teammate, and both fields are simply absent on main-thread calls. `enforce-lanes` reads that field directly, per call, with no state to write, reap, or have go stale across a crashed teammate. This also fixes the marker-bleed bug where a stale `in-subagent.*` file from one teammate silently allowed a different teammate's write, and halves the per-tool-call hook overhead (one dispatcher instead of two).

## Hook Execution Order

```
Session opens
    │
    ▼
SessionStart ──► session-start
                   ├─ { mkdir -p .brains_in_a_hat/state 2>/dev/null; ...; } — never deadlocks on a fresh repo
                   ├─ reap markers by age (no kill -0 on UUIDs)
                   ├─ write .brains_in_a_hat/.gitignore if absent
                   ├─ touch active.<SID>
                   └─ if source=resume or source=compact: write a recovery
                      marker for new-roster-bootstrap to read on the next prompt

User sends first message of session
    │
    ▼
UserPromptSubmit ──► new-roster-bootstrap
                       ├─ Kill switch: BRAINS_DISABLED=1 or project.json
                       │  {"disabled":true} → emit nothing, downstream hooks no-op
                       ├─ Emit Neal's lazy-roster orientation as additionalContext
                       │  (one-shot, gated by a marker) — spawn-on-first-intent,
                       │  reuse via SendMessage, no eager singleton spawn
                       ├─ Vault preflight (vault_is_git_repo): if missing/not a
                       │  git repo, note vault-less mode (no Dewey, no cache,
                       │  no journal — everything else still works)
                       ├─ If a resume/compact recovery marker exists: emit a
                       │  recovery banner (teammates are dead and will
                       │  lazy-respawn; TaskList first — the task list persists
                       │  across resume even though teammates don't) and clear it
                       └─ If librarian-tick's cursor shows an unprocessed
                          backlog past a threshold: nudge Neal to
                          SendMessage Dewey (wake → work → idle re-fires
                          TeammateIdle, delivering the real TICK)

Conversation about to be compacted
    │
    ▼
PreCompact ──► (inline)
               └─ touch .brains_in_a_hat/state/compact-pending.<SID>

Agent spawned
    │
    ▼
SubagentStart ──► (two steps)
                   ├─ Step 1 (inline): append {ts, agent, session, event:"start"} to activity.jsonl
                   └─ Step 2: inject-context — emits additionalContext with:
                              • main-thread transcript slice: records where
                                .type=="user" or "assistant" and .isMeta!=true,
                                text extracted from .message.content (string,
                                or a content-block array with text parts joined)
                              • ROSTER block read from
                                ~/.claude/teams/session-<SID8>/config.json
                                (peer names + roles; DM-for-clarification note)
                              • MEMORY.md index pointer (harness per-project
                                memory) so a fresh teammate knows it exists
                              • <projectGroup>--shared--learnings.md, only
                                when projectGroup != "_solo" (an ungrouped
                                repo has no shared file to leak into)
                   (no in-subagent.* marker write — enforce-lanes doesn't need one)

Agent completes
    │
    ▼
SubagentStop ──► (inline)
                  └─ append {ts, agent, session, event:"done"} to activity.jsonl
                  (no in-subagent.* marker removal — nothing was written)

Librarian goes idle
    │
    ▼
TeammateIdle ──► librarian-tick
                   ├─ Gate: agent_name must be "Dewey" (Librarian); no-op if
                   │  the vault isn't a git repo (vault-less mode)
                   ├─ Receipt check (if a pending-tick sidecar exists):
                   │    • Read PRE_HEAD, PROPOSED_CURSOR, RETRY from sidecar
                   │    • Vault HEAD advanced → commit cursor, remove sidecar
                   │    • NOOP receipt file present → advance cursor without
                   │      requiring a commit (kills empty-commit churn)
                   │    • Neither → RETRY++; RETRY≥3 → advance cursor anyway,
                   │      write an escalation state file (surfaced by
                   │      new-roster-bootstrap next session), bail
                   ├─ Cursor is keyed by a hash of the transcript file path,
                   │  not the session id — so a new session's first tick can
                   │  sweep any prior transcript with a pending cursor
                   │  (fixes tail-of-session memory loss)
                   ├─ RECORD-REQUEST fast-path: grep the slice for the
                   │  literal "RECORD-REQUEST:" token; if present, prepend a
                   │  hard mandatory-write directive
                   ├─ Snapshot vault PRE_HEAD; write the pending-tick sidecar
                   └─ Re-engage via exit 2 + a TICK prompt on stderr (the
                      sanctioned re-engage mechanism; the old
                      {"continue":false,...} JSON was undocumented and is
                      gone) — mandates a commit-or-NOOP-receipt every tick,
                      with a SHA (or NOOP) reported back to Neal

Any tool call (main thread or teammate)
    │
    ▼
PreToolUse[*] ──► enforce-lanes
                   ├─ Gate: active.* must exist
                   ├─ agent_type EMPTY (Neal, main thread):
                   │    Read, Grep, Glob, Agent, SendMessage, Task*,
                   │    AskUserQuestion, mode tools, ToolSearch, Skill,
                   │    plugin-infra Bash, curated read-only Bash — allowed.
                   │    Write/Edit allowed ONLY under .claude/plans/ or the
                   │    harness per-project memory dir (~/.claude/projects/
                   │    */memory/) — the hybrid-memory allowlist exception.
                   │    Everything else denied with a routing suggestion.
                   └─ agent_type NON-EMPTY (teammate), keyed on role:
                        • builder → full access
                        • librarian → Write/Edit/NotebookEdit and git
                          commit/push/add only when vault-scoped; else deny
                        • anything else (critic/scout/architect/unknown)
                          → read-only: deny Write/Edit/NotebookEdit and git
                          mutating ops

SendMessage tool call
    │
    ▼
PreToolUse[SendMessage] ──► guard-sendmessage
                             ├─ Allow "team-lead"/"main" unconditionally
                             ├─ Look up the recipient in
                             │  ~/.claude/teams/session-<SID8>/config.json
                             ├─ Member found → allow
                             └─ Not found (not spawned yet, typo, retired
                                name) → deny with "spawn it first via
                                Agent(name=...)" (prevents the silent-drop
                                behavior of upstream bug #25135)

Write tool call
    │
    ▼
PreToolUse[Write] ──► (inline plugin-file guard, unchanged)
                        └─ Deny if file_path is inside $CLAUDE_PLUGIN_ROOT

WebSearch / WebFetch / context7 tool call (pre)
    │
    ▼
PreToolUse ──► vault-check
                ├─ Gate: active.* must exist; vault_is_git_repo (no-op in
                │  vault-less mode); [vault-reviewed] in input → skip
                ├─ Classify tool → subtype; extract URL/query/library_id
                ├─ compute_cache_key → cache_shorthash → cache_path_for
                ├─ find_cache_hit: direct path, then source_url: grep fallback
                └─ On hit: read fetched_at/ttl_days, compute FRESH/STALE,
                   emit hookSpecificOutput.additionalContext with VAULT HINT.
                   NEVER deny/block.

Agent spawn (PostToolUse)
    │
    ▼
PostToolUse[Agent] ──► (inline)
                         └─ Append {ts, agent, session, event:"spawn", detail} to activity.jsonl

WebSearch / WebFetch / context7 tool call (post)
    │
    ▼
PostToolUse ──► capture-research
                 ├─ Gate: active.* must exist; vault_is_git_repo (no-op in
                 │  vault-less mode)
                 ├─ classify_research_type(tool_name) → skip unknown
                 ├─ Extract primary key (URL / query / library_id@version / prompt)
                 ├─ Extract body defensively: .result / .content[].text /
                 │  .results[]{title+snippet} / raw string
                 ├─ Skip: empty, <200B, HTTP-4xx
                 ├─ compute_cache_key → cache_shorthash → cache_path_for
                 │  (same key → same path → refresh-in-place dedup)
                 └─ Write atomically (tmp → mv):
                    research-cache--<subtype>--<shorthash>.md
                    with full frontmatter + body truncated to BRAINS_RESEARCH_CACHE_BODY_CAP (6000B)

Session closes
    │
    ▼
SessionEnd ──► (inline, logging only)
               └─ Append a session-close record to activity.jsonl if
                  active.* exists. No longer instructs Neal to trigger a
                  "final tick" — SessionEnd hook output isn't surfaced to
                  the model, so that instruction was dead code. Tail-of-
                  session memory loss is instead handled by librarian-tick's
                  cross-transcript sweep on the next session's first tick.
```

## Research cache schema

One markdown file per captured result, in `$VAULT_DIR` (flat, git-synced). No-op entirely if the vault isn't configured or isn't a git repo.

```
research-cache--<subtype>--<shorthash>.md
```

where `shorthash` = first 12 hex chars of `sha256(canonical_key)`.

**Frontmatter:**
```yaml
---
type: research-cache
subtype: context7 | webfetch | websearch | explore
key: <full sha256>
source_url: <url>
content_sha256: <sha256 of body>
library_version: <version or "">
query: <query string>
projectGroup: <slug>
repoKey: <slug>
captured_by: <agent_name or "unknown">
session: <session id>
fetched_at: <ISO 8601>
ttl_days: <integer>
status: fresh | stale | promoted
tags: []
related: []
---
<body, truncated to BRAINS_RESEARCH_CACHE_BODY_CAP (default 6000B)>
```

**TTL defaults:** context7 → 30d, websearch/webfetch/explore → 7d. Override via `BRAINS_TTL_<SUBTYPE>` env vars. Security/CVE content → 1d always.

## Per-call agent context (no marker files)

`enforce-lanes` and `guard-sendmessage` both read `agent_type` / `agent_id` straight off each hook call's stdin JSON — present on every call a teammate makes, absent on main-thread (Neal) calls. There is nothing to write, reap, or let go stale here; `session-start`'s marker cleanup is limited to its own `active.*` and recovery markers.

## Librarian-tick receipt model

Cursor advances **only after a confirmed vault commit, or an explicit NOOP receipt**:

1. Before emitting the TICK prompt, write `state/librarian-pending.<transcript-hash>` containing `PRE_HEAD` (current vault HEAD), `PROPOSED_CURSOR`, `RETRY=0`.
2. On the next tick, if the sidecar exists:
   - Vault HEAD advanced → commit cursor, delete sidecar, continue normally.
   - A NOOP receipt file is present (nothing needed recording this tick) → advance cursor without requiring a commit — this is what kills the old empty-commit-every-tick churn.
   - Neither → RETRY++. If RETRY ≥ 3: advance cursor (accepting the loss), write an escalation state file, bail. Otherwise re-slice the same lines and re-emit a WARN prompt.
3. Cursors are keyed by a **hash of the transcript file path**, not the session id, so a fresh session's first tick can sweep any prior transcript that still has a pending cursor (fixes the case where a session ends between ticks and the tail of its transcript is never curated).
4. An escalation from step 2 is surfaced to the user as a banner the next time `new-roster-bootstrap` runs, rather than silently disappearing.

## Upstream issues this directory works around

- **SendMessage silent drop** ([anthropics/claude-code#25135](https://github.com/anthropics/claude-code/issues/25135)): a `SendMessage` to a name that isn't a live team member returns `success:true` but the message never arrives. `guard-sendmessage` denies it up front instead, with a spawn hint.
- **`session_id` changes on `/resume`** ([anthropics/claude-code#12235](https://github.com/anthropics/claude-code/issues/12235)): the resume/compact recovery path in `session-start`/`new-roster-bootstrap` handles `source=resume` explicitly rather than depending on this bug to (accidentally) miss a stale marker.

## Scripts inventory

Scripts live in `../scripts/` (one level above this directory).

| Script | Purpose |
|--------|---------|
| `vault-init.sh` | Bootstrap the vault (optional — only needed for the global/cross-repo memory layer). Subcommands: `detect \| init \| clone \| auto`. Auto-detects `<gh-user>/hatbrains-vault` on new devices. |
| `file-plugin-issue.sh` | File a GitHub issue on `braininahat/brains-in-a-hat` from any project. Always targets the plugin repo regardless of CWD. Deduplicates by **exact** title match (case-sensitive) against `--search` candidates — a close-but-different title no longer gets mistaken for a duplicate; on an exact match it appends a recurrence comment instead of opening a new issue. Used by Builders via the `UPSTREAM-ISSUE-REQUEST:` sentinel in `neal-persona.md`. Usage: `file-plugin-issue.sh --title "..." [--body "..." \| --body @path] [--label l1,l2] [--dry-run]` |
