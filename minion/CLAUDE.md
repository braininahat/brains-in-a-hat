# minion Plugin

**Opus plans and reviews. Qwen CLI drafts code.**

This plugin wires a structured delegation workflow around the `qwen-code` CLI in headless mode. Opus (you) retains architectural judgement and code review. Qwen handles implementation drafting.

No MCP server, no llama-server autospawn, no tool-level integration. Just `qwen -p` invoked via Bash, with structured prompts and a review gate before anything lands on disk.

## Activation

Run `/minion:delegate` to activate the delegation workflow. This sets an active flag so the advisory hook fires on Write/Edit/Bash calls targeting source files. See `skills/delegate/SKILL.md` for the full workflow.

## Prompt flow

1. Opus decides whether a task is delegation-appropriate (see SKILL.md decision table).
2. Opus builds a structured prompt with explicit requirements, anti-requirements, test cases, and output format.
3. Opus invokes `scripts/qwen-delegate.sh <persona>` via the Bash tool, passing the structured prompt on stdin.
4. The wrapper runs `qwen -p` headless with the persona's system prompt appended, `-o json` for parseable output, and optionally read-only tools via `--allow-read`.
5. The wrapper extracts `.result` from the JSON and returns it on stdout.
6. Opus reviews the output against the requirements checklist (see SKILL.md) and applies it with Write/Edit — or discards and re-delegates.

Qwen never writes to the filesystem directly. It never gets `--yolo`. It never gets write/edit/shell tools.

## Personas

Persona files at `personas/*.md` are appended to qwen's system prompt via `--append-system-prompt`. They are NOT Claude Code subagent definitions — they're text templates injected into qwen's context.

- `coder` → code generation with self-check against caller's requirements.
- `analyst` → review/analysis with evidence-only claims and no hedging.

## Structured-prompt template (non-negotiable)

Qwen follows what you explicitly ask and nothing more. Benchmark-tested: tone reframes (`"you are a senior engineer, self-review"`) do not close the quality gap to Sonnet. Explicit numbered requirements do.

Every delegated prompt must have the TASK / REQUIREMENTS / ANTI-REQUIREMENTS / TESTS / OUTPUT FORMAT structure. If you can't fill every section, the task is probably too open-ended for delegation — stay in Opus.

See `skills/delegate/SKILL.md` for the full template and invocation patterns.

## Backend

Qwen expects an OpenAI-compatible endpoint. User configures this in `~/.qwen/settings.json`. Typically a local llama.cpp server started via the `llama-qwen` zshrc alias on `http://localhost:8000/v1`. If the backend is down, tell the user to start it — the plugin does NOT autospawn.

## Hook behavior

When the minion is active, `hooks/qwen-advisor` fires on Write/Edit/NotebookEdit/Bash calls that target source files. Advisory only — never blocks. The message suggests drafting via `scripts/qwen-delegate.sh` first.

## Files

```
minion/
├── .claude-plugin/plugin.json   # plugin manifest (v2.0.0)
├── CLAUDE.md                    # this file
├── hooks/
│   ├── hooks.json               # PreToolUse → qwen-advisor (only)
│   ├── lib.sh                   # activate / deactivate / is_active
│   └── qwen-advisor             # advisory hook for source-file writes
├── personas/
│   ├── coder.md                 # injected via --append-system-prompt
│   └── analyst.md
├── scripts/
│   └── qwen-delegate.sh         # the thin wrapper
└── skills/
    └── delegate/SKILL.md        # the workflow
```

## What's gone (v1.x → v2.0)

- `mcp/devstral-mcp.py` and `.mcp.json` — MCP server approach replaced by direct CLI invocation.
- `server/` — llama-server lifecycle manager (autoconfig, manager). User owns their server via zshrc aliases.
- `hooks/devstral-model-switch` — quant-switching on plan-mode transitions. Qwen manages its own backend.
- `agents/devstral-*.md` → renamed to `personas/` (not Claude Code subagents, just persona templates).

Migration: any caller using `ask_devstral_agent` or `ask_devstral` MCP tools must switch to `bash "${CLAUDE_PLUGIN_ROOT}/scripts/qwen-delegate.sh" <persona>` as documented in the skill.
