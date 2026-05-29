# hooks/

Claude Code lifecycle hooks for the brains-in-a-hat plugin (v1.0.0-alpha).

## File Inventory

| File | Purpose |
|------|---------|
| `hooks.json` | Hook wiring — maps all lifecycle events to their handler commands |
| `lib-common.sh` | Shared helpers: `derive_project_key`, `derive_project_group`, `_project_json_get`, vault path resolution |
| `lib-research.sh` | Research-cache helpers: `research_cache_dir`, `_sha256`, `classify_research_type`, `normalize_query`, `compute_cache_key`, `cache_shorthash`, `cache_path_for`, `ttl_for_type`, `is_stale`, `find_cache_hit`, `read_cache_field` |
| `neal-persona.md` | Neal's full system prompt — team roster, routing rules, retrieval routing, RECORD-REQUEST sentinel, peer agency, meta-analysis |
| `run-hook.cmd` | Cross-platform polyglot wrapper — single command path for both Windows (cmd.exe) and Unix |
| `session-start` | SessionStart — bootstraps `.brains_in_a_hat/state/`, cleans stale markers (`active.*`, `in-subagent.*`, `compact-pending.*`), writes `active.<SID>` |
| `new-roster-bootstrap` | UserPromptSubmit — on first prompt of session: emits Neal orientation instructions including `COMPACTION RECOVERY` banner when `compact-pending.<SID>` exists |
| `inject-context` | SubagentStart — injects main thread transcript slice, active learnings files, and team ROSTER block into every teammate spawn |
| `librarian-tick` | TeammateIdle (Librarian only) — advance-only-on-confirmed-commit receipt model: writes sidecar `librarian-pending.<SID>` before re-engaging; on next tick checks vault HEAD advanced; bounded retry (3×) then escalates + advances cursor |
| `enforce-neal-allowlist` | PreToolUse (parent session) — restricts Neal to read+delegate; subagents bypass via `in-subagent.*` markers |
| `enforce-teammate-lanes` | PreToolUse (subagents only) — per-role write lane enforcement: Librarian → vault only; Critic/Scout → no Write/Edit/git-commit; Builder → full access |
| `capture-research` | PostToolUse (WebSearch, WebFetch, context7) — auto-captures results as content-addressed vault markdown (`research-cache--<subtype>--<shorthash>.md`); atomic tmp→mv write; skips empty/<200B/HTTP-4xx |
| `vault-check` | PreToolUse (WebSearch, WebFetch, context7) — advisory only, never blocks; on cache hit emits `VAULT HINT [FRESH|STALE]` via `hookSpecificOutput.additionalContext`; `[vault-reviewed]` suppresses |

## Hook Execution Order

```
Session opens
    │
    ▼
SessionStart ──► session-start
                   ├─ mkdir -p .brains_in_a_hat/state
                   ├─ rm stale markers: in-subagent.*, compact-pending.*
                   │                   (from prior sessions)
                   └─ touch active.<SID>

User sends first message of session
    │
    ▼
UserPromptSubmit ──► new-roster-bootstrap
                       ├─ Emits Neal orientation as additionalContext (one-shot,
                       │  gated by gather-context-emitted.<SID> marker)
                       └─ If compact-pending.<SID> exists: emits COMPACTION RECOVERY
                          systemMessage and removes marker

Conversation about to be compacted
    │
    ▼
PreCompact ──► (inline)
               └─ touch .brains_in_a_hat/state/compact-pending.<SID>

Agent spawned
    │
    ▼
SubagentStart ──► (three steps)
                   ├─ Step 1 (inline): append {ts, agent, session, event:"start"} to activity.jsonl
                   ├─ Step 2: inject-context — emits additionalContext with:
                   │          • last N transcript turns (BRAINS_TRANSCRIPT_TURNS, default 20)
                   │          • <repoKey>--learnings.md (up to 4000B)
                   │          • <projectGroup>--shared--learnings.md (up to 4000B)
                   │          • ROSTER block from ~/.claude/teams/hatbrains-<repoKey>/config.json
                   │            (peer names + roles; DM-for-clarification note)
                   └─ Step 3 (inline): touch .brains_in_a_hat/state/in-subagent.<ID>

Agent completes
    │
    ▼
SubagentStop ──► (two steps)
                  ├─ Step 1 (inline): append {ts, agent, session, event:"done"} to activity.jsonl
                  └─ Step 2 (inline): rm .brains_in_a_hat/state/in-subagent.<ID>

Librarian goes idle
    │
    ▼
TeammateIdle ──► librarian-tick
                   ├─ Gate: agent_name must be "Librarian"
                   ├─ Receipt check (if librarian-pending.<SID> exists):
                   │    • Read PRE_HEAD, PROPOSED_CURSOR, RETRY from sidecar
                   │    • If vault HEAD advanced → commit cursor, rm sidecar, continue
                   │    • If unchanged → RETRY++; if RETRY≥3 advance cursor + escalate Neal
                   │                    else re-slice same turns + WARN prompt
                   ├─ RECORD-REQUEST fast-path: grep slice for literal "RECORD-REQUEST:"
                   │   token; if present prepend hard mandatory-write directive
                   ├─ Snapshot vault PRE_HEAD; write librarian-pending.<SID>
                   └─ Emit TICK prompt (exit 2): mandates commit every tick,
                      requires SHA receipt via SendMessage to Neal

Any tool call (parent session / Neal)
    │
    ▼
PreToolUse[*] ──► enforce-neal-allowlist
                   ├─ Gate: active.* must exist
                   ├─ If any in-subagent.* marker → exit 0 (subagent, not Neal)
                   └─ Neal allowlist: Read, Grep, Glob, LS, Agent, SendMessage,
                      Task*, Team*, AskUserQuestion, mode tools, ToolSearch, Skill,
                      plugin-infra Bash, curated read-only Bash.
                      Blocks rest with routing suggestion.

Any tool call (subagents)
    │
    ▼
PreToolUse[*] ──► enforce-teammate-lanes
                   ├─ Gate: active.* must exist AND in-subagent.* must exist
                   ├─ Builder → allow all
                   ├─ Librarian + Write/Edit: deny unless file_path is under $VAULT_DIR
                   ├─ Librarian + Bash git-commit/push: deny unless command contains $VAULT_DIR path
                   ├─ Critic/Scout + Write/Edit: always deny
                   └─ Critic/Scout + Bash git-commit/push: deny

Write tool call
    │
    ▼
PreToolUse[Write] ──► (inline plugin-file guard)
                        └─ Deny if file_path is inside $CLAUDE_PLUGIN_ROOT

WebSearch / WebFetch / context7 tool call (pre)
    │
    ▼
PreToolUse ──► vault-check
                ├─ Gate: active.* must exist; [vault-reviewed] in input → skip
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
                 ├─ Gate: active.* must exist
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
SessionEnd ──► (inline)
               └─ If active.* exists: emit additionalContext instructing Neal to
                  SendMessage Librarian for final tick (commit + push vault).
                  No retros, no phased ceremonies.
```

## Research cache schema

One markdown file per captured result, in `$VAULT_DIR` (flat, git-synced):

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

## Subagent context detection

`SubagentStart` writes `.brains_in_a_hat/state/in-subagent.<id>` (keyed by `agent_id` or `agent_type`). `SubagentStop` removes it. Both `enforce-neal-allowlist` and `enforce-teammate-lanes` use glob existence as the "am I inside a subagent?" signal. `session-start` wipes all stale markers on boot.

## Librarian-tick receipt model

Cursor advances **only after a confirmed vault commit**:

1. Before emitting the TICK prompt, write `state/librarian-pending.<SID>` containing `PRE_HEAD` (current vault HEAD), `PROPOSED_CURSOR` (new line count), `RETRY=0`.
2. On the next tick, if the sidecar exists:
   - Vault HEAD advanced → commit cursor, delete sidecar, continue normally.
   - Vault HEAD unchanged → RETRY++. If RETRY ≥ 3: advance cursor (accepting the loss), escalate Neal, bail. Otherwise re-slice same lines + warn.
3. Every TICK prompt mandates a commit (even `--allow-empty` for nothing-to-record) and requires Librarian to report the commit SHA to Neal.
